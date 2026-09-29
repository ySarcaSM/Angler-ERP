const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value = '') {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const { title, email, description } = req.body || {};
  if (
    typeof title !== 'string' ||
    typeof email !== 'string' ||
    typeof description !== 'string' ||
    !title.trim() ||
    !EMAIL_RE.test(email.trim()) ||
    !description.trim()
  ) return res.status(400).json({ error: 'Preencha todos os campos corretamente.' });

  if (title.length > 120 || email.length > 254 || description.length > 5000)
    return res.status(400).json({ error: 'Os dados enviados excedem o limite permitido.' });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'Angler ERP <onboarding@resend.dev>';
  if (!apiKey) return res.status(500).json({ error: 'O serviço de email ainda não está configurado.' });

  const safeTitle = escapeHtml(title.trim());
  const safeEmail = escapeHtml(email.trim());
  const safeDescription = escapeHtml(description.trim()).replace(/\n/g, '<br />');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email.trim()],
        subject: 'Recebemos sua mensagem — Angler ERP',
        html: '<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;"><div style="max-width:600px;margin:40px auto;background:#fff;border-radius:16px;padding:32px;"><h1>Mensagem recebida</h1><p>Olá!</p><p>Recebemos sua mensagem para a equipe do Angler ERP. Obrigado por entrar em contato.</p><div style="margin:24px 0;padding:18px;background:#f4f4f5;border-radius:12px;"><p><strong>Título:</strong> ' + safeTitle + '</p><p><strong>Email:</strong> ' + safeEmail + '</p><p><strong>Mensagem:</strong><br />' + safeDescription + '</p></div><p>Nossa equipe recebeu os dados enviados e poderá entrar em contato por este endereço de email.</p><p>Atenciosamente,<br /><strong>Equipe Angler ERP</strong></p></div></body></html>',
      }),
    });

    if (!response.ok) {
      console.error('Resend error:', await response.text());
      return res.status(502).json({ error: 'Não foi possível enviar o email de confirmação.' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Contact email error:', error);
    return res.status(500).json({ error: 'Não foi possível enviar o email de confirmação.' });
  }
}
