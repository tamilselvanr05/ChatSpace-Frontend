function rotateSize(width, height, rotation) {
    const radians = rotation * Math.PI / 180;
    return {
        width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
        height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height)
    };
}

function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("The selected image could not be decoded."));
        image.src = source;
    });
}

async function getCroppedImage(source, pixelCrop, rotation = 0, outputSize = { width: 512, height: 512 }) {
    const image = await loadImage(source);
    const rotatedBounds = rotateSize(image.width, image.height, rotation);
    const rotatedCanvas = document.createElement("canvas");
    const rotatedContext = rotatedCanvas.getContext("2d");
    rotatedCanvas.width = Math.round(rotatedBounds.width);
    rotatedCanvas.height = Math.round(rotatedBounds.height);
    rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rotatedContext.rotate(rotation * Math.PI / 180);
    rotatedContext.drawImage(image, -image.width / 2, -image.height / 2);

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = Math.max(1, Math.round(outputSize.width));
    outputCanvas.height = Math.max(1, Math.round(outputSize.height));
    const outputContext = outputCanvas.getContext("2d");
    outputContext.drawImage(
        rotatedCanvas,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        outputCanvas.width,
        outputCanvas.height
    );
    return new Promise((resolve, reject) => {
        outputCanvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("The selected image could not be cropped."));
        }, "image/jpeg", 0.9);
    });
}

export { getCroppedImage, rotateSize };
