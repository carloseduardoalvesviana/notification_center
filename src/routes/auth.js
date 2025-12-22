const ADMIN_USER = "wilsonmoura@gmail.com";
const ADMIN_PASS = "#wf2025";

async function authRoutes(server) {
  server.get("/login", async (req, reply) => {
    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login - Central de Notificações</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: #f3f4f6;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .login-card {
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            width: 100%;
            max-width: 400px;
          }
          .login-header {
            text-align: center;
            margin-bottom: 2rem;
          }
          .login-header h1 {
            color: #111827;
            font-size: 1.5rem;
            font-weight: 700;
            margin: 0;
          }
          .form-group {
            margin-bottom: 1rem;
          }
          .form-group label {
            display: block;
            color: #374151;
            font-size: 0.875rem;
            font-weight: 500;
            margin-bottom: 0.5rem;
          }
          .form-group input {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 1rem;
            box-sizing: border-box;
            transition: border-color 0.15s ease-in-out;
          }
          .form-group input:focus {
            outline: none;
            border-color: #2563eb;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
          }
          .btn {
            width: 100%;
            padding: 0.75rem;
            background-color: #2563eb;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.15s ease-in-out;
          }
          .btn:hover {
            background-color: #1d4ed8;
          }
          .error-msg {
            background-color: #fee2e2;
            color: #991b1b;
            padding: 0.75rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            font-size: 0.875rem;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="login-card">
          <div class="login-header">
            <h1>Central de Notificações</h1>
          </div>
          
          ${req.query.error ? '<div class="error-msg">Email ou senha incorretos.</div>' : ''}
          
          <form action="/login" method="POST">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required placeholder="seu@email.com">
            </div>
            <div class="form-group">
              <label for="password">Senha</label>
              <input type="password" id="password" name="password" required placeholder="Sua senha">
            </div>
            <button type="submit" class="btn">Entrar</button>
          </form>
        </div>
      </body>
      </html>
    `;
    return reply.type("text/html").send(html);
  });

  server.post("/login", async (req, reply) => {
    const { email, password } = req.body;

    if (email === ADMIN_USER && password === ADMIN_PASS) {
      // Create JWT token
      const token = server.jwt.sign({ user: email, role: 'admin' });
      
      // Set cookie
      reply.setCookie('token', token, {
        path: '/',
        httpOnly: true,
        secure: false, // Set to true if using HTTPS in production
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 // 1 day
      });
      
      return reply.redirect('/ui');
    }

    return reply.redirect('/login?error=1');
  });

  // Logout route
  server.get("/logout", async (req, reply) => {
    reply.clearCookie('token', { path: '/' });
    return reply.redirect('/login');
  });
}

module.exports = authRoutes;
