export function calculateMessageMenuPosition({
    containerRect,
    triggerRect,
    menuWidth,
    menuHeight,
    viewportWidth,
    viewportHeight,
    gutter = 8
}) {
    const topBound = Math.max(gutter, containerRect.top);
    const bottomBound = Math.min(viewportHeight - gutter, containerRect.bottom);
    const leftBound = Math.max(gutter, containerRect.left);
    const rightBound = Math.min(viewportWidth - gutter, containerRect.right);
    const anchorVisible = triggerRect.bottom > topBound && triggerRect.top < bottomBound;
    const availableHeight = bottomBound - topBound - gutter * 2;
    const availableWidth = rightBound - leftBound - gutter * 2;

    if (!anchorVisible || availableHeight <= 0 || availableWidth <= 0) return null;

    const width = Math.min(menuWidth, availableWidth);
    const height = Math.min(menuHeight, availableHeight);
    const spaceBelow = bottomBound - triggerRect.bottom - 6;
    const spaceAbove = triggerRect.top - topBound - 6;
    const openBelow = spaceBelow >= height || (spaceAbove < height && spaceBelow >= spaceAbove);
    const preferredTop = openBelow ? triggerRect.bottom + 6 : triggerRect.top - height - 6;
    const preferredLeft = triggerRect.right - width;
    const left = Math.min(Math.max(preferredLeft < leftBound + gutter ? triggerRect.left : preferredLeft, leftBound + gutter), rightBound - width - gutter);
    const top = Math.min(Math.max(preferredTop, topBound + gutter), bottomBound - height - gutter);

    return { top, left, width, maxHeight: availableHeight };
}
