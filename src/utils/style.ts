function getRGB(selector: string, property: string): { R: number, G: number, B: number; } {
    let elem = document.querySelector(selector);
    if (!elem) return { R: 0, G: 0, B: 0 };

    let rgb = window.getComputedStyle(elem, null)
        .getPropertyValue(property)
        .match(/\d+/g)
        .map(v => parseInt(v));
    return { R: rgb[0], G: rgb[1], B: rgb[2] };
}

function getPageSize(): { pageW: number, pageH: number; } {
    let w = window.getComputedStyle(document.body, null).getPropertyValue("width");
    let h = window.getComputedStyle(document.body, null).getPropertyValue("height");
    return {
        pageW: parseInt(w.match(/\d+/)[0]),
        pageH: parseInt(h.match(/\d+/)[0]),
    };
}

function optimizedPos(
    containerSize: { h: number, w: number; },
    elemSize: { h: number, w: number, },
    eventPos: { x: number, y: number, },
    xPadding: number,
    yPadding: number,
): { x: number; y: number; } {
    let x: number = 0, y: number = 0;
    if (containerSize.w - eventPos.x - xPadding - elemSize.w > 0) { // 右
        x = eventPos.x + xPadding;
        y = eventPos.y < containerSize.h / 2 ?
            Math.min(eventPos.y, (containerSize.h - elemSize.h) / 2) :
            Math.max(eventPos.y - elemSize.h, (containerSize.h - elemSize.h) / 2);
    } else if (eventPos.x - xPadding - elemSize.w > 0) { // 左
        x = eventPos.x - xPadding - elemSize.w;
        y = eventPos.y < containerSize.h / 2 ?
            Math.min(eventPos.y, (containerSize.h - elemSize.h) / 2) :
            Math.max(eventPos.y - elemSize.h, (containerSize.h - elemSize.h) / 2);
    } else if (eventPos.y - elemSize.h - yPadding > 0) { // 上
        x = eventPos.x < containerSize.w / 2 ?
            Math.min(eventPos.x, (containerSize.w - elemSize.w) / 2) :
            Math.max(eventPos.x - elemSize.w, (containerSize.w - elemSize.w) / 2);
        y = eventPos.y - yPadding - elemSize.h;
    } else { // 下
        x = eventPos.x < containerSize.w / 2 ?
            Math.min(eventPos.x, (containerSize.w - elemSize.w) / 2) :
            Math.max(eventPos.x - elemSize.w, (containerSize.w - elemSize.w) / 2);
        y = eventPos.y + yPadding;
    }
    return { x, y };
}


export { getRGB, getPageSize, optimizedPos };