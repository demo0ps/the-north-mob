# DEPLOY — THE NORTHMOB demo → GitHub Pages

The repo is committed and ready on branch `main`. All page links and asset paths are
**relative**, so the site serves correctly under a GitHub Pages project subpath
(`https://<user>.github.io/<repo>/`). No build step needed — it's static.

> GitHub Pages on a **private** repo needs a paid plan. Make the repo **public**
> for the free preview URL.

---

## Path B — you push (zero credentials shared, ~2 minutes)

1. On github.com, create a **new public repo** (e.g. `the-north-mob`). Do NOT add a README.
2. From this folder run:

   ```bash
   git remote add origin https://github.com/<YOUR-USER>/<REPO>.git
   git push -u origin main
   ```

3. Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
4. Preview in ~1 minute at: `https://<YOUR-USER>.github.io/<REPO>/`

## Path A — the agent pushes (needs a token from you)

1. Create the empty public repo on github.com as above.
2. Create a **fine-grained personal access token** (Settings → Developer settings →
   Fine-grained tokens): scoped to **only that repo**, permissions **Contents: Read/Write**
   and **Pages: Read/Write**, expiry **7 days**.
3. Paste the token in chat. The agent will push and enable Pages via the API
   (`POST /repos/{owner}/{repo}/pages`, source `main` / root), then you **revoke the token**.

## Notes

- The workspace also contains `the-north-mob-site.zip` — an archive of exactly the committed
  tree, if you prefer to download and push from your own machine.
- After deploy, hard-refresh the preview URL once (cache-busted assets make this mostly unnecessary).
- `STATUS.md` and `DECISIONS.md` are included — they document the demo honestly. Remove them
  from the repo if you don't want the client reading the working notes.
