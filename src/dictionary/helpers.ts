// from ext-saladict: https://github.com/crimx/ext-saladict
import {
    request,
    RequestUrlParam,
    sanitizeHTMLToDom,
} from "obsidian"


export interface GetSrcPageFunction {
    (text: string): string
}

export interface SearchFunction<Result> {
    (text: string): Promise<DictSearchResult<Result>>
}

export async function fetchDirtyDOM(url: string) {
    const param: RequestUrlParam = {
        url,
        method: "GET",
    }
    let response = await request(param)
    return sanitizeHTMLToDom(response)
}


export function isTagName(node: Node, tagName: string): boolean {
    return (
        ((node as HTMLElement).tagName || '').toLowerCase() ===
        tagName.toLowerCase()
    )
}

// 不知道是干啥的，瞎写的
const isInternalPage = () => false

export interface DictSearchResult<Result> {
    result: Result
    audio?: {
        uk?: string
        us?: string
        py?: string
    }
    /** generate menus on dict titlebars */
    catalog?: Array<
        | {
            // <button>
            key: string
            value: string
            label: string
            options?: undefined
        }
        | {
            // <select>
            key: string
            value: string
            options: Array<{
                value: string
                label: string
            }>
            title?: string
        }
    >
}


/**
 * Returns a anchor element
 */
export const getStaticSpeaker = (src?: string | null) => {
    if (!src) {
        return ''
    }

    const $a = document.createElement('a')
    $a.target = '_blank'
    $a.href = src
    $a.className = 'speaker'
    return $a
}

/**
 * Will jump to the website instead of searching
 * when clicking on the dict panel
 */
export function externalLink($a: HTMLElement) {
    $a.setAttribute('target', '_blank')
    $a.setAttribute('rel', 'nofollow noopener noreferrer')
}

/**
 * Get the textContent of a node or its child.
 */
export function getText(
    parent: ParentNode | null,
    selector?: string,
): string {
    if (!parent) {
        return ''
    }

    const child = selector
        ? parent.querySelector(selector)
        : (parent as HTMLElement)
    if (!child) {
        return ''
    }

    const textContent = child.textContent || ''
    //return transform ? transform(textContent) : textContent
    return textContent
}

export interface GetHTMLConfig {
    /** innerHTML or outerHTML */
    mode?: 'innerHTML' | 'outerHTML'
    /** Select child node */
    selector?: string
    /** transform text */
    transform?: null | ((text: string) => string)
    /** Give url and src a host */
    host?: string
    /** DOM Purify config */
    //config?: DOMPurify.Config
}

export function getFullLink(host: string, el: Element, attr: string): string {
    if (host.endsWith('/')) {
        host = host.slice(0, -1)
    }

    const protocol = host.startsWith('https') ? 'https:' : 'http:'

    const link = el.getAttribute(attr)
    if (!link) {
        return ''
    }

    if (/^[a-zA-Z0-9]+:/.test(link)) {
        return link
    }

    if (link.startsWith('//')) {
        return protocol + link
    }

    if (/^.?\/+/.test(link)) {
        return host + '/' + link.replace(/^.?\/+/, '')
    }

    return host + '/' + link
}

export function getHTML(
    parent: ParentNode,
    {
        mode = 'innerHTML',
        selector,
        transform,
        host,
        //config = defaultDOMPurifyConfig
    }: GetHTMLConfig = {}
): string {
    const node = selector
        ? parent.querySelector<HTMLElement>(selector)
        : (parent as HTMLElement)
    if (!node) {
        return ''
    }

    if (host) {
        const fillLink = (el: HTMLElement) => {
            if (el.getAttribute('href')) {
                el.setAttribute('href', getFullLink(host!, el, 'href'))
            }
            if (el.getAttribute('src')) {
                el.setAttribute('src', getFullLink(host!, el, 'src'))
            }
            if (isInternalPage() && el.getAttribute('srcset')) {
                el.setAttribute(
                    'srcset',
                    el
                        .getAttribute('srcset')!
                        .replace(/(,| |^)\/\//g, (_, head) => head + 'https://')
                )
            }
        }

        if (isTagName(node, 'a') || isTagName(node, 'img')) {
            fillLink(node)
        }
        node.querySelectorAll('a').forEach(fillLink)
        node.querySelectorAll('img').forEach(fillLink)
    }

    const fragment = sanitizeHTMLToDom(node.outerHTML)

    const content = fragment.firstChild ? (fragment.firstChild as any)[mode] : ''

    return transform ? transform(content) : content
}

export function getInnerHTML(
    host: string,
    parent: ParentNode,
    selectorOrConfig: string | Omit<GetHTMLConfig, 'mode' | 'host'> = {}
) {
    return getHTML(
        parent,
        typeof selectorOrConfig === 'string'
            ? { selector: selectorOrConfig, host, mode: 'innerHTML' }
            : { ...selectorOrConfig, host, mode: 'innerHTML' }
    )
}

export function getOuterHTML(
    host: string,
    parent: ParentNode,
    selectorOrConfig: string | Omit<GetHTMLConfig, 'mode' | 'host'> = {}
) {
    return getHTML(
        parent,
        typeof selectorOrConfig === 'string'
            ? { selector: selectorOrConfig, host, mode: 'outerHTML' }
            : { ...selectorOrConfig, host, mode: 'outerHTML' }
    )
}

export function handleNoResult<T = any>(): Promise<T> {
    return Promise.reject(new Error('NO_RESULT'))
}


export type HTMLString = string

export function handleNetWorkError(): Promise<never> {
    return Promise.reject(new Error('NETWORK_ERROR'))
}

/**
* Remove a child node from a parent node
*/
export function removeChild(parent: ParentNode, selector: string) {
    const child = parent.querySelector(selector)
    if (child) {
        child.remove()
    }
}

/**
 * Remove all the matching child nodes from a parent node
 */
export function removeChildren(parent: ParentNode, selector: string) {
    parent.querySelectorAll(selector).forEach(el => el.remove())
}