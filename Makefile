all:

readme:
	bin/gogs-migrate --help | node_modules/help2md/help2md-in-place README.md
