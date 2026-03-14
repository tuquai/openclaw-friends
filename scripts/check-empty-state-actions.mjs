const homepageUrl = process.env.HOMEPAGE_URL ?? "http://127.0.0.1:3020";
const response = await fetch(homepageUrl);

if (!response.ok) {
  throw new Error(`Failed to fetch homepage (${homepageUrl}): ${response.status}`);
}

const html = await response.text();
const panelTitleActions = (html.match(/class="panel-title-actions"/g) || []).length;
const emptyStateActions = (html.match(/class="empty-state-actions"/g) || []).length;

if (panelTitleActions !== 1 || emptyStateActions !== 0) {
  console.error(
    JSON.stringify(
      {
        panelTitleActions,
        emptyStateActions
      },
      null,
      2
    )
  );
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      panelTitleActions,
      emptyStateActions
    },
    null,
    2
  )
);
