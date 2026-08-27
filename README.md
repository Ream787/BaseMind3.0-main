# BaseMind

Equipment, camp and food management for a Scout group.

The app lives in **[`basemind-app/`](./basemind-app)** — see
[its README](./basemind-app/README.md) for setup and deployment.

## Background

> The app is intended to provide a simple way to track Equipment within my scout group. It was
> meant to be visible to all and update automatically. During this, I tried multiple different
> methods, including a XAML app, Microsoft Access and some other Web development Software. I then,
> after many attempts, decided to make a Web app as it would automatically sync across users and
> provide a good interface. This was going well, and I was making progress, until I broke
> something, and I tried to get GitHub Copilot to fix it. It, for some reason, reset my GitHub
> repository, which meant I could not go back to a previous working version. It somehow kept
> getting worse. I have decided to just leave it for now and try again some other time.
>
> I think the biggest issue was that I tried to implement too many features at once without having
> a proper working basic functionality. Therefore, I think the best option would be for me to
> restart from scratch and focus on making a working basic website before trying to implement AI
> chatbots, role-based access and security. Also, I have learnt how to use GitHub properly and not
> give Copilot full access to my GitHub.

That restart is what `basemind-app/` is. It began as equipment tracking plus role-based access
only, built on Supabase with access enforced by database-level Row Level Security rather than
hidden buttons, and has grown from there one working feature at a time.

The original app was removed once the rebuild replaced it; it remains in this repository's git
history if it's ever needed.

## Documentation

Full documentation — every screen, the architecture, the security model, setup and
deployment — is in **[DOCUMENTATION.md](./DOCUMENTATION.md)**, with screenshots in
[`docs/screenshots/`](./docs/screenshots/).

The same manual is also available as a [single self-contained HTML page](./docs/basemind-field-manual.html)
and as a [50-page PDF](./docs/BaseMind-Field-Manual.pdf).
