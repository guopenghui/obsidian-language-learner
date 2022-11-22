function getRGB(selector: string, property: string): { R: number, G: number, B: number } {
    let elem = document.querySelector(selector);
    if (!elem) return { R: 0, G: 0, B: 0 };

    let rgb = window.getComputedStyle(elem, null)
        .getPropertyValue(property)
        .match(/\d+/g)
        .map(v => parseInt(v));
    return { R: rgb[0], G: rgb[1], B: rgb[2] };
}



export { getRGB }