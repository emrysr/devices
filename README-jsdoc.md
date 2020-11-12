# Code documentation
> This page is part of the [EmonCMS Devices README][parent-page]

The code comments are available in the [./docs][docs] directory.

To update the documentation add or alter the comments in `www/js/index.js`  and `README.md`.

Once [jsdoc][jsdoc-docs] runs a set to flat html files are created in the [./docs][docs] 
directory showing all the functions, object, arguents and comments available

Update the docs like this:
```bash
$ jsdoc www/js/index.js README.md -d docs
```

Install jsdoc via npm:

```bash
$ npm install --save-dev jsdoc
```

A hosted version (v0.2.3) hosted github pages version is here: http://code.emrys.cymru/devices/

---

[jsdoc-docs]: https://jsdoc.app/about-tutorials.html
[parent-page]: ./README.md