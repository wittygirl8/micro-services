/*
 * @Description: This takes two input, one is frequency value,
 * for monthy frequency value should be between 1 to 31, recommended to have 28 and below,
 * just in case month has 28 days then that month this will not execute for the merchants with
 * more than 28 as frequency value.
 * Second input is merchant id, printing it in log for reference.
 */

export const validateCronMonthly = (frequency_value, merchant_id) => {
    var currentDate = new Date();
    var currentDay = currentDate.getDate();
    console.log(
        `Validating Cron date: Frequency value for merchant id ${merchant_id} is ${frequency_value} and current day is ${currentDay},${
            currentDay === frequency_value
        }`
    );
    return currentDay == frequency_value;
};
