import zh from "./locale/zh"
import en from "./locale/en"

const localeMap: { [k: string]: Partial<typeof en> } = {
    en,
    zh,
}


const lang = window.localStorage.getItem("language")
const locale = localeMap[lang || "en"]

export function t(text: keyof typeof en): string {
    return (locale && locale[text]) || en[text]
}