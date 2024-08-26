import { t } from "./lang/helper";

const dict = {
    NAME: "Language Learner"
};

type Position = {
    x: number;
    y: number;
};

//继承 GlobalEventHandlersEventMap：EventMap 继承了 GlobalEventHandlersEventMap，
//这意味着 EventMap 将包含 GlobalEventHandlersEventMap 中的所有事件，同时添加自定义事件。
interface EventMap extends GlobalEventHandlersEventMap {
    "obsidian-langr-search": CustomEvent<{
        selection: string,
        target?: HTMLElement,
        evtPosition?: Position,
    }>;
    "obsidian-langr-refresh": CustomEvent<{
        expression: string,
        type: string,
        status: number,
        meaning: string,
        aliases: string[],
    }>;
    "obsidian-langr-refresh-stat": CustomEvent<{}>;
}



export { dict };
export type { EventMap, Position }


