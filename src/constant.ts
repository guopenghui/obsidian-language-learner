import { t } from "./lang/helper";

const dict = {
    NAME: "Language Learner"
};

interface EventMap extends GlobalEventHandlersEventMap {
    "obsidian-langr-search": CustomEvent<{
        selection: string,
        target?: HTMLElement,
    }>;
    "obsidian-langr-refresh": CustomEvent<{
        expression: string,
        type: string,
        status: number,
    }>;
    "obsidian-langr-refresh-stat": CustomEvent<{}>;
}



export { dict };
export type { EventMap }


