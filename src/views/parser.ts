import { text2HTML } from './parser2'


async function parse(data: string) {
    let lines = data.split("\n")
    let articleStart = lines.indexOf("^^^article") + 1
    let articleEnd = lines.indexOf("^^^words")

    let article = lines.slice(articleStart, articleEnd).join("\n")

    let newHTML = await text2HTML(article.trim())
    return newHTML
}

export default parse
