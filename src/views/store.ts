import { reactive } from "vue"

let store = reactive({
    text: "",
    dark: document.body.hasClass("theme-dark"),
})

export default store