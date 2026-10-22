function createWallpaperUpload(editedBlob) {
    const formData = new FormData();
    formData.append("file", new File([editedBlob], "chat-wallpaper.jpg", { type: "image/jpeg" }));
    return formData;
}

export { createWallpaperUpload };
