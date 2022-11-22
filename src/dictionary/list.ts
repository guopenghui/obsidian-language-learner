import { t } from "../lang/helper"
import Youdao from "./youdao/View.vue"
import Cambridge from "./cambridge/View.vue"
import Jukuu from "./jukuu/View.vue"


const dicts = {
    "youdao": { name: t("Youdao"), Cp: Youdao },
    "cambridge": { name: t("Cambridge"), Cp: Cambridge },
    "jukuu": { name: t("Jukuu"), Cp: Jukuu },
}

export { dicts }