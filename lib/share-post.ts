/**
 * Share Post helpers: caption builder, 9:16 share-card canvas renderer
 * (mirrors the mobile ShareCard layout), and clipboard/download utilities.
 */

export const SHARE_CARD_WIDTH = 1080
export const SHARE_CARD_HEIGHT = 1920

const ACCENT_COLOR = "#E50914"

export interface SharePostMedia {
  id: number
  mediaType: "movie" | "tv"
  title: string
  posterUrl: string | null
  backdropUrl: string | null
  releaseYear: string
  genres: string[]
  userRating: number
}

/**
 * Build the share caption. Includes the title (and year/rating when known).
 */
export function buildShareCaption({
  title,
  releaseYear,
  userRating,
}: Pick<SharePostMedia, "title" | "releaseYear" | "userRating">): string {
  const titlePart = releaseYear ? `${title} (${releaseYear})` : title
  const ratingPart =
    userRating > 0 ? ` My rating: ${userRating}/10.` : ""
  return `Check out ${titlePart} on ShowSeek!${ratingPart}`
}

export function getSharePostFilename(media: Pick<SharePostMedia, "mediaType" | "id">): string {
  return `showseek-${media.mediaType}-${media.id}.png`
}

function loadImage(url: string, timeoutMs = 10000): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error("Image load timed out")),
      timeoutMs,
    )
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => {
      window.clearTimeout(timer)
      resolve(image)
    }
    image.onerror = () => {
      window.clearTimeout(timer)
      reject(new Error(`Failed to load image: ${url}`))
    }
    image.src = url
  })
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const scale = Math.max(dw / image.width, dh / image.height)
  const sw = dw / scale
  const sh = dh / scale
  const sx = (image.width - sw) / 2
  const sy = (image.height - sh) / 2
  ctx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""

  const pushLine = (line: string) => {
    if (lines.length < maxLines) lines.push(line)
  }

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate
      continue
    }

    // Current line is full. If it's the last allowed line, ellipsize instead.
    if (lines.length === maxLines - 1) {
      current = `${current} ${word}`
      while (current && ctx.measureText(`${current}…`).width > maxWidth) {
        current = current.slice(0, -1)
      }
      pushLine(`${current.trim()}…`)
      return lines
    }

    pushLine(current)
    current = word
  }

  if (current && lines.length < maxLines) lines.push(current)
  return lines
}

/**
 * Render the 1080x1920 share card, mirroring the mobile MediaShareCard:
 * blurred poster backdrop + dark gradient, centered poster, title,
 * `year • genres` metadata, and a rating pill.
 * Falls back to a pure gradient background when artwork fails to load.
 */
export async function renderShareCard(
  media: SharePostMedia,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas")
  canvas.width = SHARE_CARD_WIDTH
  canvas.height = SHARE_CARD_HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas 2D is not supported")

  // Base gradient (mobile fallback colors)
  const base = ctx.createLinearGradient(0, 0, 0, SHARE_CARD_HEIGHT)
  base.addColorStop(0, "#1a1a2e")
  base.addColorStop(0.55, "#16213e")
  base.addColorStop(1, "#0f3460")
  ctx.fillStyle = base
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT)

  // Blurred artwork backdrop. Matches mobile (ShareCard renders the poster
  // blurred, not the backdrop): prefer the poster — the same URL already
  // proven loadable by the foreground — with the backdrop as fallback.
  const backdropSource = media.posterUrl ?? media.backdropUrl
  if (backdropSource) {
    try {
      const backdrop = await loadImage(backdropSource)
      ctx.save()
      ctx.filter = "blur(60px) brightness(0.9)"
      drawCover(ctx, backdrop, -80, -80, SHARE_CARD_WIDTH + 160, SHARE_CARD_HEIGHT + 160)
      ctx.restore()
    } catch (error) {
      console.warn("Share card: background artwork failed to load", {
        url: backdropSource,
        error,
      })
    }
  }

  // Dark overlay gradient for legibility (mobile three-stop values)
  const overlay = ctx.createLinearGradient(0, 0, 0, SHARE_CARD_HEIGHT)
  overlay.addColorStop(0, "rgba(0,0,0,0.4)")
  overlay.addColorStop(0.5, "rgba(0,0,0,0.6)")
  overlay.addColorStop(1, "rgba(0,0,0,0.85)")
  ctx.fillStyle = overlay
  ctx.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT)

  // Centered poster (top-anchored with room below so the rating block
  // composes tightly with the footer instead of floating mid-card)
  const posterWidth = 550
  const posterHeight = 825
  const posterX = (SHARE_CARD_WIDTH - posterWidth) / 2
  const posterY = 340
  if (media.posterUrl) {
    try {
      const poster = await loadImage(media.posterUrl)
      ctx.save()
      ctx.shadowColor = "rgba(0,0,0,0.5)"
      ctx.shadowBlur = 60
      ctx.shadowOffsetY = 20
      drawCover(ctx, poster, posterX, posterY, posterWidth, posterHeight)
      ctx.restore()
    } catch (error) {
      console.warn("Share card: poster artwork failed to load", {
        url: media.posterUrl,
        error,
      })
    }
  }

  const centerX = SHARE_CARD_WIDTH / 2
  ctx.textAlign = "center"
  ctx.textBaseline = "top"

  // Title (up to 3 lines)
  let cursorY = posterY + posterHeight + 60
  ctx.fillStyle = "#ffffff"
  ctx.font = "700 76px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  const titleLines = wrapLines(ctx, media.title, SHARE_CARD_WIDTH - 160, 3)
  const titleLineHeight = 92
  for (const line of titleLines) {
    ctx.fillText(line, centerX, cursorY, SHARE_CARD_WIDTH - 160)
    cursorY += titleLineHeight
  }

  // Metadata: year • genres
  cursorY += 12
  const metaParts = [
    media.releaseYear,
    media.genres.slice(0, 2).join(", "),
  ].filter(Boolean)
  if (metaParts.length > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.75)"
    ctx.font = "400 40px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    ctx.fillText(metaParts.join(" • "), centerX, cursorY)
    cursorY += 64
  }

  // Rating section: unrated cards show an accent "Rate it on ShowSeek!"
  // pill; rated cards skip the pill and show only "My Rating" + score.
  // (Deliberate divergence from mobile, which keeps the pill in both states.)
  const hasRating = media.userRating > 0
  cursorY += hasRating ? 64 : 48
  const displayRating = Number.isInteger(media.userRating)
    ? media.userRating
    : Number(media.userRating.toFixed(1))

  if (!hasRating) {
    const pillText = "Rate it on ShowSeek!"
    ctx.font = "700 44px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    const pillTextWidth = ctx.measureText(pillText).width
    const pillWidth = pillTextWidth + 120
    const pillHeight = 110
    const pillX = centerX - pillWidth / 2
    ctx.fillStyle = ACCENT_COLOR
    ctx.beginPath()
    ctx.roundRect(pillX, cursorY, pillWidth, pillHeight, pillHeight / 2)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.textBaseline = "middle"
    ctx.fillText(pillText, centerX, cursorY + pillHeight / 2 + 2)
    ctx.textBaseline = "top"
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.75)"
    ctx.font = "700 40px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    ctx.fillText("My Rating", centerX, cursorY)
    cursorY += 60
    ctx.fillStyle = ACCENT_COLOR
    ctx.font = "700 120px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    ctx.fillText(`${displayRating}/10`, centerX, cursorY)
  }

  // Watermark footer on rated cards only: sits tight under the score.
  // Unrated cards end cleanly at the CTA pill.
  if (hasRating) {
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    ctx.font = "600 36px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    ctx.fillText("ShowSeek", centerX, SHARE_CARD_HEIGHT - 70)
  }

  return canvas
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("Failed to encode PNG"))
    }, "image/png")
  })
}

/**
 * Copy a PNG blob to the clipboard. Throws when unsupported so callers can
 * fall back to downloading (Safari/Firefox lack ClipboardItem PNG support).
 */
export async function copyPngToClipboard(blob: Blob): Promise<void> {
  if (
    typeof ClipboardItem === "undefined" ||
    !("write" in navigator.clipboard)
  ) {
    throw new Error("Image clipboard is not supported in this browser")
  }
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ])
}

export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    // Fallback for non-secure contexts / older browsers
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  try {
    const ok = document.execCommand("copy")
    if (!ok) throw new Error("Copy failed")
  } finally {
    document.body.removeChild(textarea)
  }
}

export function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.setTimeout(() => URL.revokeObjectURL(url), 5000)
}
