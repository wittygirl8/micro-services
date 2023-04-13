/*
 * @Description: This takes two input, one is frequency value,
 * for weekly frequency values would be week days like MONDAY, TUESDAY etc
 * Second input is merchant id, printing it in log for reference.
 */
export function validateCronWeek(frequency_value, merchant_id) {
    var days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']; // Cron won't run on Saturday and Sunday, In case if we run this will execute on weekends as well
    var currentDate = new Date();
    var currentDay = days[currentDate.getDay()];
    console.log(
        `Validating Cron week: Frequency value for merchant id ${merchant_id} is ${frequency_value} and current day is ${currentDay},${
            currentDay == frequency_value
        }`
    );
    return currentDay == frequency_value;
}
