import { reactive } from "vue"

let store = reactive({
    text: "",
    dark: false,
    fontSize: "",
    fontFamily: "",
    lineHeight: "",
})

export default store