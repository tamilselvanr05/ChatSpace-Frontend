export function updateProfilePhotoViewer(previous, changedUserId, profilePhoto) {
    if (!previous || previous.userId?.toString() !== changedUserId?.toString()) return previous;
    return profilePhoto ? { ...previous, profilePhoto } : null;
}
