import { ref, CSSProperties, getCurrentInstance } from "vue";
import { Notice } from "obsidian";
import { t } from "@/lang/helper";
import { ExpressionInfo, Sentence } from "@/storage/interface";
import { SelectOption, GlobalThemeOverrides } from "naive-ui";
import Plugin from "@/plugin";
import { LearnPanelView } from "./LearnPanelView";
import { ReadingView } from "./ReadingView";
import { search } from "@dict/youdao/engine";
import { useEvent } from "@/utils/use";

export function useLearn() {
    const plugin: Plugin = getCurrentInstance()?.appContext.config.globalProperties.plugin;
    const view: LearnPanelView = getCurrentInstance()?.appContext.config.globalProperties.view;

    const model = ref<ExpressionInfo>({
        expression: null,
        meaning: null,
        status: 0,
        t: "WORD",
        tags: [],
        notes: [],
        sentences: [],
        connections: [],
        date: ''
    });

    const rules = {
        expression: {
            required: true,
            trigger: ["blur", "input"],
            message: t("Please input a word/phrase"),
        },
        meaning: {
            required: true,
            trigger: ["blur", "input"],
            message: t("A short definition is needed"),
        },
        t: {
            required: true,
            trigger: "change",
            message: "Expression can be a word or phrase",
        },
        status: {
            required: true,
        },
    };

    const sourceRule = {
        required: true,
        trigger: ["blur", "input"],
        message: "At least input a source sentence",
    };

    const labelStyle: CSSProperties = {
        fontWeight: "bold",
    };

    const statusOptions = [
        { text: t("Ignore"), style: "" },
        { text: t("Learning"), style: "background-Color: #ff980055" },
        { text: t("Familiar"), style: "background-Color: #ffeb3c55" },
        { text: t("Known"), style: "background-Color: #9eda5855" },
        { text: t("Learned"), style: "background-Color: #4cb05155" },
    ];

    const themeOverrides: GlobalThemeOverrides = {
        common: {},
        Form: {
            labelFontSizeTopMedium: "15px",
            feedbackFontSizeMedium: "13px",
            blankHeightMedium: "5px",
            feedbackHeightMedium: "22px",
        },
        Radio: {
            buttonBorderRadius: "5px",
            fontSizeMedium: "13px",
            fontSizeSmall: "13px",
            buttonHeightSmall: "22px",
        },
        Input: {
            fontSizeSmall: "12px",
            paddingSmall: "0 5px",
        },
        DynamicInput: {
            actionMargin: "0 0 0 5px",
        },
    };

    function onCreateSentence() {
        return {
            sentence: "",
            trans: "",
            origin: "",
        };
    }

    // Tag Search Logic
    const tagOptions = ref<SelectOption[]>([]);
    const tagLoading = ref(false);
    let tags: string[] = [];

    async function tagSearch(query: string) {
        tagLoading.value = true;
        if (query.length < 2) {
            tags = await plugin.storage.DB().getTags();
        }
        tagLoading.value = false;

        if (!query.length) {
            tagOptions.value = tags.map((v) => ({ label: v, value: v }));
            return;
        }
        tagOptions.value = tags
            .filter((v) => ~v.indexOf(query))
            .map((v) => ({ label: v, value: v }));
    }

    async function submit(oldExpression?: string): Promise<boolean> {
        // Validation
        if (!model.value.expression) {
            new Notice(t("Expression is empty!"));
            return false;
        }
        if (!model.value.meaning) {
            new Notice(t("Meaning is empty!"));
            return false;
        }
        if (
            model.value.expression.trim().split(" ").length > 1 &&
            model.value.t === "WORD"
        ) {
            new Notice(t("It looks more like a PHRASE than a WORD"));
            return false;
        }

        // Remove old expression if provided (for update case)
        if (oldExpression) {
            await plugin.storage.DB().removeExpression(oldExpression);
        }

        const data = JSON.parse(JSON.stringify(model.value)) as ExpressionInfo;
        data.expression = data.expression.trim().toLowerCase();
        if (!data.connections) {
            data.connections = [];
        }
        
        // DB Post
        const statusCode = await plugin.storage.DB().postExpression(data);

        if (statusCode !== 200) {
            new Notice("Submit failed");
            console.warn("Submit failed, please check server status");
            return false;
        }
        
        new Notice("Submit successful");
        dispatchEvent(
            new CustomEvent("obsidian-langr-refresh", {
                detail: {
                    expression: model.value.expression,
                    type: model.value.t,
                    status: model.value.status,
                },
            })
        );
        dispatchEvent(new CustomEvent("obsidian-langr-refresh-stat"));

        if (plugin.settings.auto_refresh_db) {
            plugin.refreshTextDB();
        }

        return true;
    }

    return {
        model,
        rules,
        sourceRule,
        labelStyle,
        statusOptions,
        themeOverrides,
        onCreateSentence,
        tagOptions,
        tagLoading,
        tagSearch,
        plugin,
        view,
        submit,
    };
}

export function useSearchListener(model: any, plugin: Plugin, view: LearnPanelView) {
    useEvent(window, "obsidian-langr-search", async (evt: CustomEvent) => {
        const selection = evt.detail.selection as string;
        const expr = await plugin.storage.DB().getExpression(selection);

        let exprType = "WORD";
        if (selection.trim().includes(" ")) {
            exprType = "PHRASE";
        }

        const target = evt.detail.target as HTMLElement;

        let sentenceText = "";
        let storedSen: Sentence = null;
        let defaultOrigin: string = null;
        let filledTrans = null;

        console.log(target , 'useSearchListener')

        if (target) {
            const sentenceEl = target.parentElement.hasClass("stns")
                ? target.parentElement
                : target.parentElement.parentElement;
            sentenceText = sentenceEl.textContent;

            storedSen = await plugin.storage.DB().tryGetSen(sentenceText);

            const reading = view.app.workspace.getActiveViewOfType(ReadingView);

            if (reading) {
                const presetOrigin = view.app.metadataCache.getFileCache(reading.file)
                    .frontmatter?.["langr-origin"];
                defaultOrigin = presetOrigin ? presetOrigin : reading.file.name;
            }

            if (plugin.settings.use_machine_trans) {
                try {
                    const res = await search(sentenceText);
                    if (res && (res.result as any).translation) {
                        const html = (res.result as any).translation as string;
                        filledTrans =
                            html
                                .match(/<p>([^<>]+)<\/p>/g)[1]
                                ?.match(/<p>(.*)<\/p>/)[1] ?? null;
                    }
                } catch (e) {
                    filledTrans = "";
                }
            }
        }

        if (expr) {
            if (sentenceText) {
                if (!storedSen) {
                    expr.sentences = expr.sentences.concat({
                        expression: expr.expression,
                        sentence: sentenceText,
                        trans: filledTrans,
                        origin: defaultOrigin,
                    });
                } else {
                    const added = expr.sentences.find(
                        (sen: Sentence) => sen.sentence === sentenceText
                    );
                    if (!added) {
                        expr.sentences = expr.sentences.concat(storedSen);
                    }
                }
            }
            model.value = expr;
            return;
        } else {
            if (!target) {
                model.value = {
                    expression: selection,
                    meaning: "",
                    status: 1,
                    t: exprType,
                    tags: [],
                    notes: [],
                    connections: [],
                    sentences: [],
                };
                return;
            }

            model.value = {
                expression: selection,
                meaning: "",
                status: 1,
                t: exprType,
                tags: [],
                notes: [],
                connections: [],
                sentences: storedSen
                    ? [storedSen]
                    : [
                        {
                            sentence: sentenceText,
                            trans: filledTrans,
                            origin: defaultOrigin,
                        },
                    ],
            } as ExpressionInfo;
        }
    });
}
