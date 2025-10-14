#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    import markdown
except Exception:
    print('Missing dependency: markdown. Install with: pip install -r requirements.txt')
    raise


ROOT = Path(__file__).parent.resolve()
PAGES_DIR = ROOT / 'pages'
OUT_BLOG = ROOT / 'blog.html'
OUT_POSTS_DIR = ROOT / 'posts'
CONFIG = PAGES_DIR / 'blog-posts.json'


def slug_from_filename(filename: str) -> str:
    return Path(filename).stem


def extract_metadata_and_body(text: str):
    # Find title (first H1)
    title = None
    title_match = re.search(r'^#\s+(.+)$', text, flags=re.M)
    if title_match:
        title = title_match.group(1).strip()

    # Find metadata lines (after title, optional)
    published = None
    read_time = ''
    tags = []

    # Find lines like **Published:** ...
    pub_match = re.search(r'^\*\*Published:\*\*\s*(.+)$', text, flags=re.M)
    if pub_match:
        published = pub_match.group(1).strip()

    rt_match = re.search(r'^\*\*Read Time:\*\*\s*(.+)$', text, flags=re.M)
    if rt_match:
        read_time = rt_match.group(1).strip()

    tags_match = re.search(r'^\*\*Tags:\*\*\s*(.+)$', text, flags=re.M)
    if tags_match:
        tags = [t.strip() for t in tags_match.group(1).split(',') if t.strip()]

    # Remove the title and metadata lines from body
    lines = text.splitlines()
    # find index of first title line
    start_idx = 0
    for i, line in enumerate(lines):
        if re.match(r'^#\s+', line):
            start_idx = i + 1
            break

    # skip subsequent metadata or blank lines
    while start_idx < len(lines) and re.match(r'^(\*\*.*\*\*).*|^\s*$', lines[start_idx]):
        start_idx += 1

    body = '\n'.join(lines[start_idx:]).strip()

    return {
        'title': title or '',
        'published': published or None,
        'read_time': read_time or '',
        'tags': tags,
        'body': body,
    }


def render_markdown(md_text: str) -> str:
    return markdown.markdown(md_text, extensions=['extra', 'tables'])


def build_post_page(post):
    """Create an individual post HTML file in posts/{slug}.html and return a listing snippet."""
    slug = post['slug']
    out_file = OUT_POSTS_DIR / f"{slug}.html"
    OUT_POSTS_DIR.mkdir(exist_ok=True)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{post['title']} - Blog</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {{ background: #121212; color: #e0e0e0; font-family: monospace; min-height:100vh }}
    a{{ color: #801f7a }}
    .container{{ max-width:900px }}
    .post-card{{ background:#1e1e1e; border:1px solid #333; border-radius:8px; padding:2rem; margin-top:2rem }}
    .post-title{{ color:#801f7a }}
    .post-meta{{ color:#b0b0b0; margin-bottom:1rem }}
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container">
      <a class="navbar-brand" href="../index.html">Lincoln Scheer</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><a class="nav-link" href="../index.html">Home</a></li>
          <li class="nav-item"><a class="nav-link active" href="../blog.html">Blog</a></li>
          <li class="nav-item"><a class="nav-link" href="../resume.pdf" target="_blank">Resume</a></li>
        </ul>
      </div>
    </div>
  </nav>

  <div class="container">
    <article class="post-card">
      <h1 class="post-title">{post['title']}</h1>
      <div class="post-meta">{post['published'] or ''} • {post['read_time'] or ''}</div>
      <div class="post-body">{post['html']}</div>
      <div style="margin-top:1rem">{' '.join([f'<span style="background:#333;color:#fff;padding:.25rem .5rem;border-radius:6px;margin-right:.5rem">{t}</span>' for t in post['tags']])}</div>
    </article>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>"""

    out_file.write_text(html, encoding='utf-8')
    # return snippet for index
    snippet = f"<article class=\"blog-post\"><h2><a href=\"posts/{slug}.html\">{post['title']}</a></h2><div class=\"blog-meta\">{post['published'] or ''} • {post['read_time'] or ''}</div><div class=\"post-preview\">{post['html'][:200]}{'...' if len(post['html']) > 200 else ''}</div></article>"
    return snippet


def build_blog(posts):
    # posts: list of dicts
    posts_snippets = []
    for post in posts:
        posts_snippets.append(build_post_page(post))

    posts_html = '\n'.join(posts_snippets)

    full = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Blog - Lincoln Scheer</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {{ background: #121212; color: #e0e0e0; font-family: monospace; min-height:100vh }}
    a{{ color: #801f7a }}
    .container{{ max-width:900px }}
    .blog-header{{ text-align:center; padding:2.5rem 0 }}
    .blog-post{{ background:#1e1e1e; border:1px solid #333; border-radius:8px; padding:1.5rem; margin-bottom:1.5rem }}
    .blog-post h2 a{{ color:#801f7a; text-decoration:none }}
    .blog-meta{{ color:#b0b0b0 }}
  </style>
</head>
<body>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container">
      <a class="navbar-brand" href="index.html">Lincoln Scheer</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><a class="nav-link" href="index.html">Home</a></li>
          <li class="nav-item"><a class="nav-link active" href="blog.html">Blog</a></li>
          <li class="nav-item"><a class="nav-link" href="resume.pdf" target="_blank">Resume</a></li>
        </ul>
      </div>
    </div>
  </nav>

  <div class="container">
    <header class="blog-header">
      <h1>Blog</h1>
      <p>Thoughts, tutorials, and updates</p>
    </header>

    <main>
      {posts_html}
    </main>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
"""

    OUT_BLOG.write_text(full, encoding='utf-8')


def load_posts_from_config():
    if not CONFIG.exists():
        return None
    try:
        with CONFIG.open('r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def build_all():
    # Scan pages dir for .md files and extract metadata from them
    if not PAGES_DIR.exists():
        print('No pages/ directory found. Create one and add .md files.')
        return
    
    posts_data = []
    for md in sorted(PAGES_DIR.glob('*.md')):
        text = md.read_text(encoding='utf-8')
        meta = extract_metadata_and_body(text)
        html = render_markdown(meta['body'])
        posts_data.append({
            'slug': slug_from_filename(md.name),
            'title': meta['title'] or md.stem,
            'published': meta['published'] or datetime.now().strftime('%Y-%m-%d'),
            'read_time': meta['read_time'],
            'tags': meta['tags'],
            'description': meta.get('description', ''),
            'html': html,
        })

    # Sort by published date (newest first) if present
    def parse_date(d):
        try:
            return datetime.fromisoformat(d)
        except Exception:
            try:
                return datetime.strptime(d, '%Y-%m-%d')
            except Exception:
                return datetime.min

    posts_data.sort(key=lambda x: parse_date(x.get('published') or ''), reverse=True)
    build_blog(posts_data)


def clean():
    if OUT_BLOG.exists():
        OUT_BLOG.unlink()
        print('Removed', OUT_BLOG)
    if OUT_POSTS_DIR.exists():
        for f in OUT_POSTS_DIR.glob('*.html'):
            f.unlink()
        try:
            OUT_POSTS_DIR.rmdir()
        except Exception:
            pass
        print('Removed posts/ directory')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--clean', action='store_true', help='remove generated files')
    args = parser.parse_args()

    if args.clean:
        clean()
        return

    build_all()


if __name__ == '__main__':
    main()
