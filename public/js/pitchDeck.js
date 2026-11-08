// Render sanitized HTML with the browser's own layout engine, then use that
// canvas as a normal 3D texture (perspective, occlusion and reflections intact).
export async function renderPitchDeck(deck) {
  if (!deck?.slides?.length) throw new Error("The presentation is missing.");
  return Promise.all(deck.slides.map(async (slide) => {
    const template = document.createElement("template");
    template.innerHTML = slide.html;
    const root = document.createElement("div");
    root.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    root.style.cssText = `width:${deck.width}px;height:${deck.height}px;overflow:hidden;background:#101f28;color:#f6f1e7;font-family:Arial;box-sizing:border-box`;
    root.append(template.content);
    const markup = new XMLSerializer().serializeToString(root);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${deck.width}" height="${deck.height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = deck.width;
    canvas.height = deck.height;
    canvas.getContext("2d").drawImage(image, 0, 0);
    return canvas;
  }));
}
