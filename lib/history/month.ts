export function isHistoryMonth(month: string): boolean {
  return /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)
}
export function historyMonthName(month: string): string {
  const [year, number] = month.split("-").map(Number)
  return new Date(year, number - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}
