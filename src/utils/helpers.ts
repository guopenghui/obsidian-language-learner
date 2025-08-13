export function playAudio(src: string) {
    new Audio(src).play();
}

/**
 * Extracts and formats the content of <li> tags from an HTML string using DOM manipulation.
 * Each <li> content will be on its own line.
 * @param htmlString The HTML string to process.
 * @returns The extracted content with list items on separate lines.
 */
export function stripHtmlTags(htmlString: string): string {
  if (!htmlString) {
    return '';
  }

  // 创建一个临时的 div 元素来解析 HTML 字符串
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlString;

  // 使用 querySelectorAll 找到所有 <li> 元素
  const liElements = tempDiv.querySelectorAll('li');

  // 如果没有找到 <li> 元素，返回空字符串
  if (liElements.length === 0) {
    return '';
  }

  // 遍历所有 <li> 元素，提取它们的文本内容
  const extractedText = Array.from(liElements).map(li => li.textContent.trim());

  // 将所有提取出的文本用换行符连接起来
  return extractedText.join('\n');
}