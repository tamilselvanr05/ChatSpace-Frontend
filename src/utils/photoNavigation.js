export function getWrappedImageIndex(index, direction, length) {
    if (!Number.isInteger(length) || length < 1) return -1;
    return (index + direction + length) % length;
}
