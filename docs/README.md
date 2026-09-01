# Abou Sobhi — demo

A single self-contained page: the customer's phone and the shop's order screen,
side by side. It is what gets shown to the shop before the real system is
deployed, so it runs with no server, no account and no build step — open
`index.html` and it works.

Orders live in the browser's own storage, which is why an order placed here
reaches the shop screen in the same browser but not another device. The real
build in `../abou-sobhi/` has a database behind it and does exactly that.

Served at <https://khaledtahle-byte.github.io/best-repo-ever/> when GitHub Pages
is pointed at this folder (Settings → Pages → Branch, `/docs`).
