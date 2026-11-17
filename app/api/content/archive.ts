type Event = {
  artist?: string; album?: string; date?: string; place?: string;
  year?: string; detail?: string; url?: string; imageUrl?: string; archived?: boolean; series?: string;
};
type Album = {
  artist?: string; title?: string; imageUrl?: string; year?: string; editionId?: string; series?: string;
};
type Archived = Event & { archivedAt: string };
type Published = { album: Album; events: Event[]; archive?: Archived[] };

const initial: Published = {
  album: { artist: 'Little Simz', title: 'Lotus', imageUrl: '/lotus-cover.jpg', year: '2025' },
  events: [{ artist: 'Little Simz', album: 'Lotus', date: '2026-11-10', place: 'In redazione',
    url: 'https://www.eventbrite.it/e/2004230308806' }],
};

function albumKey(artist?: string, title?: string) {
  return [artist, title].map(s => s?.trim().toLocaleLowerCase('it')).join('|');
}

export function applyArchive(previous: Published | null, next: Published, stamp: string) {
  const current = previous || initial;
  const archive = [...(current.archive || [])];
  const oldKey = albumKey(current.album.artist, current.album.title);
  const sameEdition = current.album.editionId && current.album.editionId === next.album.editionId;
  if (sameEdition || oldKey === albumKey(next.album.artist, next.album.title)) return archive;

  const matching = current.events.find(event => albumKey(event.artist, event.album) === oldKey);
  const archived: Archived = {
    ...matching,
    artist: current.album.artist,
    album: current.album.title,
    year: matching?.year || current.album.year || '',
    series: matching?.series || current.album.series || '',
    imageUrl: matching?.imageUrl || current.album.imageUrl || '',
    archived: true,
    archivedAt: stamp,
  };
  next.events = next.events.map(event => {
    const isPrevious = albumKey(event.artist, event.album) === oldKey &&
      (!matching?.date || event.date === matching.date);
    return isPrevious ? { ...event, archived: true } : event;
  });
  const alreadyArchived = archive.some(event =>
    albumKey(event.artist, event.album) === oldKey && event.date === archived.date);
  if (!alreadyArchived) archive.push(archived);
  return archive;
}
