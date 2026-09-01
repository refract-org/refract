FROM oven/bun:1.4.0
RUN bun install -g @refract-org/cli
ENTRYPOINT ["wikihistory"]
CMD ["analyze", "Bitcoin", "--depth", "brief"]
