// 06 CONTACT
// Blank page, "contact us", a blinking cursor. The first keystroke lands in
// the (invisible) email field and both fields appear. Typing in the message
// field pops the send button.
//
// The markup starts open (stage "typing"); build() switches it to blank "idle".
// Without JavaScript, the page hides Send and explains that sending needs it.
// The preview policy blocks native form submission.
//
// NOT CONNECTED: submissions are not sent anywhere yet. Wire `deliver()`
// to the chosen destination once it is decided. It must resolve to
// { ok: true } on success; anything else (or a throw) shows a retry message
// and keeps what the visitor wrote.

const section = document.querySelector('.contact');
const form = section.querySelector('.contact__form');
const email = form.querySelector('#c-email');
const message = form.querySelector('#c-message');
const trap = form.querySelector('#c-company');
const send = form.querySelector('.contact__send');
const status = form.querySelector('.contact__status');
const emailError = form.querySelector('#c-email-error');
let inView = false;

const setStage = (stage) => { form.dataset.stage = stage; };
const isField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
const shown = () => parseFloat(getComputedStyle(section).opacity) > 0.5;
// Stricter than type="email": needs a dot and a 2+ letter ending after the @.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

function autosize() {
  message.style.height = 'auto';
  message.style.height = `${message.scrollHeight}px`;
}

async function deliver(/* data */) {
  // Placeholder until a destination is chosen (email service, form endpoint, CRM).
  return { ok: true, preview: true };
}

function thanks(preview) {
  // Hidden fields must not retain a tall textarea's scrollable overflow.
  message.style.height = '';
  status.textContent = 'thank you. we will be in touch. ';
  if (preview) {
    const note = document.createElement('small');
    note.textContent = 'Preview build: this form is not connected yet, so nothing was sent.';
    status.appendChild(note);
  }
}

export function build() {
  setStage('idle');
  form.dataset.ready = 'false';

  new IntersectionObserver(([e]) => { inView = e.intersectionRatio >= 0.5; }, { threshold: [0, 0.5, 1] }).observe(section);

  // Any printable key while the blank page is on screen goes into the email box.
  window.addEventListener('keydown', (e) => {
    if (!inView || !shown() || e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || e.key === ' ') return;
    // Only when nothing in particular has focus (the page itself), so a key never
    // lands in a field the visitor already finished or interrupts the send button.
    const a = document.activeElement;
    if (a && a !== document.body && a !== section) return;
    if (form.dataset.stage === 'sent' || form.dataset.stage === 'sending') return;
    (form.dataset.stage === 'idle' || !email.value ? email : message).focus({ preventScroll: true });
  });

  // Click or tap anywhere on the page puts you in the right field.
  section.addEventListener('click', (e) => {
    if (e.target.closest('input, textarea, button, a') || form.dataset.stage === 'sent') return;
    (form.dataset.stage === 'idle' || !email.value ? email : message).focus({ preventScroll: true });
  });

  // Keyboard users can Tab here from anywhere; bring the blank page on screen.
  form.addEventListener('focusin', () => {
    if (shown()) return;
    const still = !document.documentElement.classList.contains('is-motion'); // the page's one motion policy
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: still ? 'auto' : 'smooth' });
  });

  email.addEventListener('input', () => {
    if (form.dataset.stage === 'idle' && email.value) setStage('typing');
    status.textContent = '';
    emailError.textContent = '';
    email.removeAttribute('aria-invalid');
    email.removeAttribute('aria-describedby');
  });

  message.addEventListener('input', () => {
    autosize();
    if (form.dataset.stage === 'idle') setStage('typing');
    form.dataset.ready = message.value.trim() ? 'true' : 'false';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.stage === 'sending') return;
    const addr = email.value.trim();
    if (!EMAIL.test(addr)) {
      emailError.textContent = 'that email looks incomplete.';
      email.setAttribute('aria-invalid', 'true');
      email.setAttribute('aria-describedby', 'c-email-error');
      email.focus();
      return;
    }
    if (!message.value.trim()) { message.focus(); return; }
    // Bots fill the hidden field. Act as if it worked and send nothing.
    if (trap.value) { setStage('sent'); thanks(false); return; }

    setStage('sending');
    send.disabled = true;
    status.textContent = 'sending.';
    let res;
    try {
      // A stalled network shows the retry message instead of hanging on "sending."
      const timeout = new Promise((resolve) => setTimeout(() => resolve({ ok: false }), 15000));
      res = await Promise.race([deliver({ email: addr, message: message.value.trim() }), timeout]);
    } catch {
      res = { ok: false };
    }
    send.disabled = false;
    if (!res?.ok) {
      setStage('typing');
      status.textContent = 'that did not go through. please try again.';
      return;
    }
    setStage('sent');
    thanks(res.preview);
    // The send button is now hidden; keep keyboard focus on the confirmation.
    status.tabIndex = -1;
    status.focus({ preventScroll: true });
    status.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
}
