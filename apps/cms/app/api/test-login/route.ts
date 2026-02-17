import { NextResponse } from 'next/server';

export async function GET() {
    const html = `
    <!DOCTYPE html>
    <html>
    <body>
    <script>
        (async () => {
            try {
                const res = await fetch('http://localhost:3030/authentication', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        strategy: 'local',
                        email: 'donec.dev@gmail.com',
                        password: 'Test1234!'
                    })
                });
                const data = await res.json();
                if (data.accessToken) {
                    localStorage.clear();
                    localStorage.setItem('lumaway_token', data.accessToken);
                    document.cookie = 'lumaway_token=' + data.accessToken + '; path=/; max-age=86400; SameSite=Strict';
                    document.body.innerText = 'Login successful! Redirecting...';
                    window.location.href = '/en/projects';
                } else {
                    document.body.innerText = 'Login failed: ' + JSON.stringify(data);
                }
            } catch (e) {
                document.body.innerText = 'Error: ' + e.message;
            }
        })();
    </script>
    <p>Logging in...</p>
    </body>
    </html>
    `;
    return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' }
    });
}

