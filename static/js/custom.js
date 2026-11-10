$(document).ready(function () {
    window.turnstileWidgets = {};
    window.turnstilePassed = {};

    window.onloadTurnstileCallback = function () {
        console.log('Turnstile загружен');

        document.querySelectorAll('.contacts-form').forEach(form => {
            const formId = form.dataset.formId;
            const widgetEl = form.querySelector('.cf-turnstile');
            const errorEl = form.querySelector('.turnstile-wrapper .invalid-feedback');

            if (!formId || !widgetEl) return;
            if (turnstileWidgets[formId]) return;

            const sitekey = widgetEl.dataset.sitekey;
            if (!sitekey) {
                console.warn(`Sitekey not found for form ${formId}`);
                return;
            }

            const widgetId = turnstile.render(widgetEl, {
                sitekey,
                callback: token => {
                    turnstilePassed[formId] = true;
                    if (errorEl) errorEl.style.display = 'none';
                },
                'expired-callback': () => {
                    turnstilePassed[formId] = false;
                    if (errorEl) errorEl.style.display = 'block';
                },
            });

            turnstileWidgets[formId] = widgetId;
            turnstilePassed[formId] = false;
        });

        document.querySelectorAll('.basic-form').forEach(form => {
            const formId = form.dataset.formId;
            const widgetEl = form.querySelector('.cf-turnstile');
            const errorEl = form.querySelector('.turnstile-wrapper .invalid-feedback');

            if (!formId || !widgetEl) return;
            if (turnstileWidgets[formId]) return;

            const sitekey = widgetEl.dataset.sitekey;
            if (!sitekey) {
                //console.warn(`Sitekey not found for form ${formId}`);
                return;
            }

            const widgetId = turnstile.render(widgetEl, {
                sitekey,
                callback: token => {
                    turnstilePassed[formId] = true;
                    if (errorEl) errorEl.style.display = 'none';
                },
                'expired-callback': () => {
                    turnstilePassed[formId] = false;
                    if (errorEl) errorEl.style.display = 'block';
                },
            });

            turnstileWidgets[formId] = widgetId;
            turnstilePassed[formId] = false;
        });
    };


    const isValid = (field, condition) => {
        if (condition) {
            field.removeClass('is-invalid').addClass('is-valid');
            return true;
        } else {
            field.removeClass('is-valid').addClass('is-invalid');
            return false;
        }
    };

    $('.contacts-form').on('submit', function (event) {
        event.preventDefault();
        event.stopPropagation();

        const $form = $(this);
        const formId = $form.data('form-id');

        if (!turnstilePassed[formId]) {
            $form.find('.turnstile-wrapper .invalid-feedback').show();
            return false;
        }

        const $name = $form.find('input[name="name"]');
        const $email = $form.find('input[name="email"]');
        const $message = $form.find('textarea[name="message"]');
        const $button = $form.find('button');
        const $successMsg = $form.find('.form-sent-message');
        let timeout;

        let valid = true;
        valid = isValid($name, $name.val().trim().length >= 3) && valid;
        valid = isValid($email, $email.val().trim().length >= 5 && $email.val().indexOf('@') > 0) && valid;
        valid = isValid($message, $message.val().trim().length >= 3) && valid;

        if (!valid) return false;

        $button.css({'pointer-events': 'none', 'opacity': '0.6'});

        $.ajax({
            type: 'POST',
            dataType: 'json',
            url: $form.attr('action'),
            data: $form.serialize(),
            success: function () {
                $button.css({'pointer-events': 'auto', 'opacity': '1'});
                $form.find('input, textarea').removeClass('is-valid is-invalid');
                $form.find('input:not([type="hidden"]), textarea').val('');
                clearTimeout(timeout);
                $successMsg.fadeIn();
                timeout = setTimeout(() => $successMsg.fadeOut(), 5000);

                turnstile.reset(turnstileWidgets[formId]);
                turnstilePassed[formId] = false;
            },
            error: function (response) {
                if (response.responseJSON?.errors?.email) {
                    isValid($email, false);
                }
                $button.css({'pointer-events': 'auto', 'opacity': '1'});
            },
        });
    });

    $('.basic-form').on('submit', function (event) {
        event.preventDefault();
        event.stopPropagation();

        let $form = $(this);
        let formId = $form.data('form-id');

        if (!turnstilePassed[formId]) {
            $form.find('.turnstile-wrapper .invalid-feedback').show();
            return false;
        }

        let $code = $form.find('input[name="code"]');
        let $button = $form.find('button');
        let $successMsg = $form.find('.form-sent-message');
        let timeout;

        let valid = true;
        valid = isValid($code, $code.val().trim().length >= 3) && valid;

        if (!valid) return false;

        $button.css({'pointer-events': 'none', 'opacity': '0.6'});
        $successMsg.removeClass('error');

        $.ajax({
            type: 'POST',
            dataType: 'json',
            url: $form.attr('action'),
            data: $form.serialize(),
            success: function (response) {
                $successMsg.html(response.message);
                clearTimeout(timeout);
                $successMsg.fadeIn();
                timeout = setTimeout(() => $successMsg.fadeOut(), 5000);
                $button.css({'pointer-events': 'auto', 'opacity': '1'});

                turnstile.reset(turnstileWidgets[formId]);
                turnstilePassed[formId] = false;
            },
            error: function (response) {

                $successMsg.html(JSON.parse(response.responseText).message);
                clearTimeout(timeout);
                $successMsg.fadeIn();
                $successMsg.addClass('error');
                timeout = setTimeout(() => $successMsg.fadeOut(), 5000);
                $button.css({'pointer-events': 'auto', 'opacity': '1'});
            },
        });
    });

});
