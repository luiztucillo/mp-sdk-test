class MP {
  constructor () {
    this.payments = [];

    this.sdk = new MercadoPago('APP_USR-83a56a39-84fc-4dfa-b0f6-002f2447aa1e');

    this.elements = {
      form: document.getElementById('form-checkout'),
      title: document.querySelector('h1'),
      identification: {
        type: document.getElementById('form-checkout__identificationType'),
        number: document.getElementById('form-checkout__identificationNumber')
      },
      payment: {
        methodId: document.getElementById('paymentMethodId'),
        issuer: document.getElementById('form-checkout__issuer'),
        installments: document.getElementById('form-checkout__installments'),
        amount: document.getElementById('transactionAmount'),
        cardNumber: null,
        expirationDate: null,
        securityCode: null,
        cardHolderName: document.getElementById('form-checkout__cardholderName'),
      },
    };

    this.placeholders = {
      issuer: 'Banco emissor',
      installments: 'Parcelas'
    };

    this.currentBin = null;

    this.currentCard = 1;
    this.maxCards = 3;
  }

  init () {
    this.elements.payment.cardNumber = this.sdk.fields.create('cardNumber', {
      placeholder: 'Número do cartão'
    }).mount('form-checkout__cardNumber');


    this.elements.payment.cardNumber.on('binChange', (evt) => this.handleCardNumberChange(evt));

    this.elements.payment.expirationDate = this.sdk.fields.create('expirationDate', {
      placeholder: 'MM/YY',
    }).mount('form-checkout__expirationDate');

    this.elements.payment.securityCode = this.sdk.fields.create('securityCode', {
      placeholder: 'Código de segurança'
    }).mount('form-checkout__securityCode');

    this.getIdentificationTypes();

    this.elements.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
  }

  async getIdentificationTypes () {
    try {
      const identificationTypes = await this.sdk.getIdentificationTypes();
      this.createSelectOptions(this.elements.identification.type, identificationTypes);
    } catch (e) {
      return console.error('Error getting identificationTypes: ', e);
    }
  }

  async getIssuers (paymentMethod, bin) {
    try {
      const { id: paymentMethodId } = paymentMethod;
      return await this.sdk.getIssuers({ paymentMethodId, bin });
    } catch (e) {
      console.error('error getting issuers: ', e);
    }
  }

  async createSelectOptions (elem, options, labelsAndKeys = {
    label: 'name',
    value: 'id'
  }) {
    const { label, value } = labelsAndKeys;

    elem.options.length = 0;

    const tempOptions = document.createDocumentFragment();

    options.forEach(option => {
      const optValue = option[value];
      const optLabel = option[label];

      const opt = document.createElement('option');
      opt.value = optValue;
      opt.textContent = optLabel;

      tempOptions.appendChild(opt);
    });

    elem.appendChild(tempOptions);
  }

  clearSelectsAndSetPlaceholders () {
    const elements = [
      {
        element: this.elements.payment.issuer,
        placeholder: this.placeholders.issuer
      },
      {
        element: this.elements.payment.installments,
        placeholder: this.placeholders.installments
      },
    ];

    elements.forEach(item => {
      const currOptions = [...item.element.children];
      currOptions.forEach(child => child.remove());

      const optionElement = document.createElement('option');
      optionElement.textContent = item.placeholder;
      optionElement.setAttribute('selected', '');
      optionElement.setAttribute('disabled', '');

      item.element.appendChild(optionElement);
    });
  }

  updateTitle () {
    this.elements.title.innerText = `Cartão ${this.currentCard}`;
  }

  updatePCIFieldsSettings (paymentMethod) {
    const { settings } = paymentMethod;

    const cardNumberSettings = settings[0].card_number;
    this.elements.payment.cardNumber.update({
      settings: cardNumberSettings
    });

    const securityCodeSettings = settings[0].security_code;
    this.elements.payment.securityCode.update({
      settings: securityCodeSettings
    });
  }

  async updateIssuer (paymentMethod, bin) {
    const { additional_info_needed, issuer } = paymentMethod;
    let issuerOptions = [issuer];

    if (additional_info_needed.includes('issuer_id')) {
      issuerOptions = await this.getIssuers(paymentMethod, bin);
    }

    this.createSelectOptions(this.elements.payment.issuer, issuerOptions);
  }

  async updateInstallments (paymentMethod, bin) {
    try {
      const installments = await this.sdk.getInstallments({
        amount: document.getElementById('transactionAmount').value,
        bin,
        paymentTypeId: 'credit_card'
      });
      const installmentOptions = installments[0].payer_costs;
      const installmentOptionsKeys = {
        label: 'recommended_message',
        value: 'installments'
      };

      this.createSelectOptions(this.elements.payment.installments, installmentOptions, installmentOptionsKeys);
    } catch (error) {
      console.error('error getting installments: ', error);
    }
  }

  async handleCardNumberChange (data) {
    const { bin } = data;
    try {
      if (!bin && this.elements.payment.methodId.value) {
        this.clearSelectsAndSetPlaceholders();
        this.elements.payment.methodId.value = '';
      }

      if (bin && bin !== this.currentBin) {
        const { results } = await this.sdk.getPaymentMethods({ bin });
        const paymentMethod = results[0];

        this.elements.payment.methodId.value = paymentMethod.id;
        this.updatePCIFieldsSettings(paymentMethod);
        this.updateIssuer(paymentMethod, bin);
        this.updateInstallments(paymentMethod, bin);
      }

      this.currentBin = bin;
    } catch (e) {
      console.error('error getting payment methods: ', e);
    }
  }

  async handleFormSubmit (event) {
    event.preventDefault();

    this.load(this.elements.form)

    const success = await this.createCardToken();

    if (success) {
      this.currentCard++;
    }

    if (this.currentCard > this.maxCards) {
      try {
        const response = await fetch('http://localhost:3000/payment', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            email: document.getElementById('form-checkout__email').value,
            amount: this.elements.payment.amount.value,
            payments: this.payments,
          })
        });

        const body = await response.json();

        this.endLoad()

        const pre = document.createElement('div')
        document.querySelector('.main-container').appendChild(pre)
        pre.innerHTML = 'SUCESSO'
        // pre.innerHTML = `${body.length} pagamento criados<br /><br /> ${body.map(pay => `ID: ${pay.body.id} no valor de R$${pay.body.transaction_amount}`).join('<br />')}`

        return;
      } catch (e) {
        console.error('Erro ao pagar', e);
        return;
      }
    }

    this.updateTitle();
    this.endLoad(this.elements.form)
  }

  async createCardToken () {
    try {
      const token = await this.sdk.fields.createCardToken({
        cardholderName: this.elements.payment.cardHolderName.value,
        identificationType: this.elements.identification.type.value,
        identificationNumber: this.elements.identification.number.value,
      });

      this.payments.push({
        token: token.id,
        paymentMethodId: this.elements.payment.methodId.value,
        issuer: this.elements.payment.issuer.value,
        identificationType: this.elements.identification.type.value,
        identificationNumber: this.elements.identification.number.value,
      });

      return true;
    } catch (e) {
      return false;
    }
  }

  load (hide) {
    const loader = document.createElement('div');
    loader.setAttribute('id', 'loader');
    document.querySelector('.main-container').appendChild(loader)
    loader.innerText = 'Carregando...';

    if (hide) {
      hide.style.display = 'none'
    }
  }

  endLoad(unhide) {
    const el = document.getElementById('loader');
    if (el) {
      el.remove()
    }
    if (unhide) {
      unhide.style.display = 'block'
    }
  }
}

const mp = new MP();
mp.init();
