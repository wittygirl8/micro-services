const { PinPaymentPayout } = require('../functions/pinpayment/pin-payout.service.js');
const pinPayoutService = new PinPaymentPayout();

test('getDelayPayoutExcludingWeekends ~ delay_payout ~ 1', () => {
    let payout_delay = 1;
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-01 23:59:59')).toBe(
        '2022-05-30 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-02 23:59:59')).toBe(
        '2022-05-31 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-03 23:59:59')).toBe(
        '2022-06-01 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-04 23:59:59')).toBe(
        '2022-06-02 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-05 23:59:59')).toBe(
        '2022-06-02 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-06 23:59:59')).toBe(
        '2022-06-02 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-07 23:59:59')).toBe(
        '2022-06-03 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-08 23:59:59')).toBe(
        '2022-06-06 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-09 23:59:59')).toBe(
        '2022-06-07 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-10 23:59:59')).toBe(
        '2022-06-08 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-11 23:59:59')).toBe(
        '2022-06-09 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-12 23:59:59')).toBe(
        '2022-06-09 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-13 23:59:59')).toBe(
        '2022-06-09 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-14 23:59:59')).toBe(
        '2022-06-10 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-15 23:59:59')).toBe(
        '2022-06-13 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-16 23:59:59')).toBe(
        '2022-06-14 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-17 23:59:59')).toBe(
        '2022-06-15 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-18 23:59:59')).toBe(
        '2022-06-16 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-19 23:59:59')).toBe(
        '2022-06-16 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-20 23:59:59')).toBe(
        '2022-06-16 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-21 23:59:59')).toBe(
        '2022-06-17 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-22 23:59:59')).toBe(
        '2022-06-20 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-23 23:59:59')).toBe(
        '2022-06-21 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-24 23:59:59')).toBe(
        '2022-06-22 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-25 23:59:59')).toBe(
        '2022-06-23 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-26 23:59:59')).toBe(
        '2022-06-23 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-27 23:59:59')).toBe(
        '2022-06-23 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-28 23:59:59')).toBe(
        '2022-06-24 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-29 23:59:59')).toBe(
        '2022-06-27 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-30 23:59:59')).toBe(
        '2022-06-28 23:59:59'
    );
});

test('getDelayPayoutExcludingWeekends ~ delay_payout ~ 2', () => {
    let payout_delay = 2;
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-01 23:59:59')).toBe(
        '2022-05-27 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-02 23:59:59')).toBe(
        '2022-05-30 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-03 23:59:59')).toBe(
        '2022-05-31 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-04 23:59:59')).toBe(
        '2022-06-01 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-05 23:59:59')).toBe(
        '2022-06-01 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-06 23:59:59')).toBe(
        '2022-06-01 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-07 23:59:59')).toBe(
        '2022-06-02 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-08 23:59:59')).toBe(
        '2022-06-03 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-09 23:59:59')).toBe(
        '2022-06-06 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-10 23:59:59')).toBe(
        '2022-06-07 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-11 23:59:59')).toBe(
        '2022-06-08 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-12 23:59:59')).toBe(
        '2022-06-08 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-13 23:59:59')).toBe(
        '2022-06-08 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-14 23:59:59')).toBe(
        '2022-06-09 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-15 23:59:59')).toBe(
        '2022-06-10 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-16 23:59:59')).toBe(
        '2022-06-13 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-17 23:59:59')).toBe(
        '2022-06-14 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-18 23:59:59')).toBe(
        '2022-06-15 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-19 23:59:59')).toBe(
        '2022-06-15 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-20 23:59:59')).toBe(
        '2022-06-15 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-21 23:59:59')).toBe(
        '2022-06-16 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-22 23:59:59')).toBe(
        '2022-06-17 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-23 23:59:59')).toBe(
        '2022-06-20 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-24 23:59:59')).toBe(
        '2022-06-21 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-25 23:59:59')).toBe(
        '2022-06-22 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-26 23:59:59')).toBe(
        '2022-06-22 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-27 23:59:59')).toBe(
        '2022-06-22 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-28 23:59:59')).toBe(
        '2022-06-23 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-29 23:59:59')).toBe(
        '2022-06-24 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-30 23:59:59')).toBe(
        '2022-06-27 23:59:59'
    );
});

test('getDelayPayoutExcludingWeekends ~ delay_payout ~ 3', () => {
    let payout_delay = 3;
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-01 23:59:59')).toBe(
        '2022-05-26 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-02 23:59:59')).toBe(
        '2022-05-27 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-03 23:59:59')).toBe(
        '2022-05-30 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-04 23:59:59')).toBe(
        '2022-05-31 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-05 23:59:59')).toBe(
        '2022-05-31 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-06 23:59:59')).toBe(
        '2022-05-31 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-07 23:59:59')).toBe(
        '2022-06-01 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-08 23:59:59')).toBe(
        '2022-06-02 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-09 23:59:59')).toBe(
        '2022-06-03 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-10 23:59:59')).toBe(
        '2022-06-06 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-11 23:59:59')).toBe(
        '2022-06-07 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-12 23:59:59')).toBe(
        '2022-06-07 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-13 23:59:59')).toBe(
        '2022-06-07 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-14 23:59:59')).toBe(
        '2022-06-08 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-15 23:59:59')).toBe(
        '2022-06-09 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-16 23:59:59')).toBe(
        '2022-06-10 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-17 23:59:59')).toBe(
        '2022-06-13 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-18 23:59:59')).toBe(
        '2022-06-14 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-19 23:59:59')).toBe(
        '2022-06-14 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-20 23:59:59')).toBe(
        '2022-06-14 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-21 23:59:59')).toBe(
        '2022-06-15 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-22 23:59:59')).toBe(
        '2022-06-16 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-23 23:59:59')).toBe(
        '2022-06-17 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-24 23:59:59')).toBe(
        '2022-06-20 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-25 23:59:59')).toBe(
        '2022-06-21 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-26 23:59:59')).toBe(
        '2022-06-21 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-27 23:59:59')).toBe(
        '2022-06-21 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-28 23:59:59')).toBe(
        '2022-06-22 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-29 23:59:59')).toBe(
        '2022-06-23 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-30 23:59:59')).toBe(
        '2022-06-24 23:59:59'
    );
});

test('getDelayPayoutExcludingWeekends ~ delay_payout ~ 4', () => {
    let payout_delay = 4;
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-01 23:59:59')).toBe(
        '2022-05-25 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-02 23:59:59')).toBe(
        '2022-05-26 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-03 23:59:59')).toBe(
        '2022-05-27 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-04 23:59:59')).toBe(
        '2022-05-30 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-05 23:59:59')).toBe(
        '2022-05-30 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-06 23:59:59')).toBe(
        '2022-05-30 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-07 23:59:59')).toBe(
        '2022-05-31 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-08 23:59:59')).toBe(
        '2022-06-01 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-09 23:59:59')).toBe(
        '2022-06-02 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-10 23:59:59')).toBe(
        '2022-06-03 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-11 23:59:59')).toBe(
        '2022-06-06 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-12 23:59:59')).toBe(
        '2022-06-06 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-13 23:59:59')).toBe(
        '2022-06-06 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-14 23:59:59')).toBe(
        '2022-06-07 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-15 23:59:59')).toBe(
        '2022-06-08 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-16 23:59:59')).toBe(
        '2022-06-09 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-17 23:59:59')).toBe(
        '2022-06-10 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-18 23:59:59')).toBe(
        '2022-06-13 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-19 23:59:59')).toBe(
        '2022-06-13 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-20 23:59:59')).toBe(
        '2022-06-13 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-21 23:59:59')).toBe(
        '2022-06-14 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-22 23:59:59')).toBe(
        '2022-06-15 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-23 23:59:59')).toBe(
        '2022-06-16 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-24 23:59:59')).toBe(
        '2022-06-17 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-25 23:59:59')).toBe(
        '2022-06-20 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-26 23:59:59')).toBe(
        '2022-06-20 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-27 23:59:59')).toBe(
        '2022-06-20 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-28 23:59:59')).toBe(
        '2022-06-21 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-29 23:59:59')).toBe(
        '2022-06-22 23:59:59'
    );
    expect(pinPayoutService.getDelayPayoutExcludingWeekends(payout_delay, '2022-06-30 23:59:59')).toBe(
        '2022-06-23 23:59:59'
    );
});
