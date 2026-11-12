/** Fields submitted as a form to PayHere's checkout URL. */
export interface PayHereFormFields {
  /** PayHere checkout URL — where the browser should POST this form. */
  checkout_url: string;
  merchant_id: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  order_id: string;
  items: string;
  currency: "LKR";
  amount: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: "LK";
  hash: string;
}
