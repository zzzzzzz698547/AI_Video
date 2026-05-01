import { Injectable } from "@nestjs/common";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

@Injectable()
export class SystemSpeechTtsService {
  async synthesize(text: string, outputPath: string) {
    await mkdir(path.dirname(outputPath), { recursive: true });

    const script = `
      Add-Type -AssemblyName System.Speech;
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      $synth.Volume = 100;
      $synth.Rate = 1;
      $synth.SetOutputToWaveFile("${outputPath.replace(/"/g, '""')}");
      $synth.Speak("${text.replace(/"/g, '""').replace(/\r?\n/g, ' ')}");
      $synth.Dispose();
    `;

    try {
      await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], {
        windowsHide: true
      });
    } catch {
      // If the local speech engine is unavailable, the render pipeline will fall back to silent audio.
      return null;
    }

    return outputPath;
  }
}
