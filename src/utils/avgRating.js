export default function GetAvgRating(ratingArr) {
    if (!Array.isArray(ratingArr) || ratingArr.length === 0) return 0;
    
    let validRatings = 0;
    const totalReviewCount = ratingArr.reduce((acc, curr) => {
        const rating = Number(curr?.rating);
        if (!isNaN(rating) && rating > 0) {
            acc += rating;
            validRatings++;
        }
        return acc;
    }, 0);

    if (validRatings === 0) return 0;

    const multiplier = Math.pow(10, 1);
    const avgReviewCount =
        Math.round((totalReviewCount / validRatings) * multiplier) / multiplier;

    return avgReviewCount || 0;
}

