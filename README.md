# changemoji

A opinionated [gitmoji](https://gitmoji.carloscuesta.me/) changelog generator.

## Usage

Arguments :

- `path` : The path to the git repository. Default to `.`.

```bash
$ npx changemoji <path?>
$ pnpm dlx changemoji <path?>
```

## Roadmap

- [_] Add options to generate `from` .. `to` passing any git reference
- [_] Infering the repo URL and generating real links to tags and commits
- [_] Better categorizing (kinda broken for now), could use a config file to allow custom categories
- [_] Investigate perf with `zx`
- [_] Partial diffing, avoid reparsing tags that have already been done

## Thanks

- [Bard](https://bard.google.com/) & [Copilot](https://github.com/features/copilot) for assisting me
- [Gitmoji](https://gitmoji.dev/) for existing
- [gitmoji-changelog](https://github.com/frinyvonnick/gitmoji-changelog) for inspiration
- [zx](https://github.com/google/zx) for easy cross plateform shell interaction
