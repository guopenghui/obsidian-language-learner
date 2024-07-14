import { reactive } from "vue"; //通过使用 reactive，可以确保对象中的数据变化时，自动触发相关的视图更新

const store = reactive({
    text: "",
    dark: false,
    themeChange: false,
    fontSize: "",
    fontFamily: "",
    lineHeight: "",
    popupSearch: true,
    searchPinned: false,
    dictsChange: false,
    dictHeight: "",
});

export default store; //将 store 对象导出，以便在其他组件或模块中可以导入并使用。