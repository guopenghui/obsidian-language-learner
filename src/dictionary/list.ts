import { t } from "@/lang/helper";
import Youdao from "./youdao/View.vue";
import Cambridge from "./cambridge/View.vue";
import Jukuu from "./jukuu/View.vue";
import HJdict from "./hjdict/View.vue";
import DeepL from "./deepl/View.vue";

const dicts = {
    "youdao": {
        name: t("Youdao"),
        description: `${t("English")} <=> ${t("Chinese")}`,
        Cp: Youdao
    },
    "cambridge": {
        name: t("Cambridge"),
        description: `${t("English")} => ${t("Chinese")}`,
        Cp: Cambridge
    },
    "jukuu": {
        name: t("Jukuu"),
        description: `${t("English")} <=> ${t("Chinese")}`,
        Cp: Jukuu
    },
    "hjdict": {
        name: t("Hujiang"),
        description: `${t("English")},${t("Japanese")}, ${t("Korean")}, ${t("Spanish")}, ${t("French")}, ${t("Deutsch")} <=> ${t("Chinese")}`,
        Cp: HJdict
    },
    "deepl": {
        name: "DeepL",
        description: `All <=> ${t("Chinese")}`,
        Cp: DeepL
    }
};

export { dicts };