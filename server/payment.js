const mercadopago = require('mercadopago');

const payment = async (amount, email, payments) => {
  mercadopago.configurations.setAccessToken("APP_USR-6572843794902693-042014-a4aa04415966ee83f7ecf4de624a54a0-493175988");

  const paymentsResponse = []

  for (let i = 0; i < payments.length; i ++) {
    const paymentData = {
      transaction_amount: Number(amount/payments.length),
      token: payments[i].token,
      description: `Pagamento de testes com ${payments.length} cartões`,
      installments: 1,
      payment_method_id: payments[i].paymentMethodId,
      issuer_id: payments[i].issuer,
      payer: {
        email: email,
        identification: {
          type: payments[i].identificationType,
          number: payments[i].identificationNumber,
        }
      }
    }

    console.log(paymentData)

    try {
      const response = await mercadopago.payment.save(paymentData)
      paymentsResponse.push(response);
    } catch (e) {
      paymentsResponse.push({'error': e.message});
    }
  }

  return paymentsResponse
}

module.exports = payment
