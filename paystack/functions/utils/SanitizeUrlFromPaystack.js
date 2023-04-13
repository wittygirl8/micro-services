export const SanitizeUrlFromPaystack = (url_string) => {
    //for some reason, the paystack is sending the webhook url with &id: instead of &id
    //removing the unexpected : from the url
    let new_url = url_string.replace("&id;", "&id")
    return new_url
}