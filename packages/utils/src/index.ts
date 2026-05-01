export function createSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-");
}

export function splitKeywords(input: string) {
  return input
    .split(/[\n,，/|]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function paginate(page = 1, pageSize = 20, total = 0) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, Math.min(100, pageSize));
  return {
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / safePageSize))
  };
}

