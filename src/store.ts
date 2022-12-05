import { reactive } from "vue";

const store = reactive({
    text: "",
    dark: false,
    themeChange: false,
    fontSize: "",
    fontFamily: "",
    lineHeight: "",
    searchPinned: false,
});

export default store;