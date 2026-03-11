// controllers/blogController.js
const { query } = require('../config/db');

const PLACEHOLDER_IMAGES = ['/img/France.jpg', '/img/Monaco.jpg', '/img/Montenegro.jpg', '/img/Costa%20Del%20Sol.jpg', '/img/London.jpg'];

/** Generate URL-safe slug from title */
function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled';
}

/** Ensure unique slug by appending -2, -3 etc if needed */
async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let n = 1;
  for (;;) {
    const params = excludeId ? [slug, excludeId] : [slug];
    const sql = excludeId
      ? 'SELECT id FROM blog_posts WHERE slug = $1 AND id != $2'
      : 'SELECT id FROM blog_posts WHERE slug = $1';
    const { rows } = await query(sql, params);
    if (!rows.length) return slug;
    slug = `${baseSlug}-${++n}`;
  }
}

/**
 * Public: List all blog posts with pagination, search, and sort
 */
exports.listPosts = async (req, res, next) => {
  try {
    const { q = '', sort = 'date_new', page = 1 } = req.query;

    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    if (q && String(q).trim()) {
      whereConditions.push(`(
        LOWER(title) LIKE LOWER($${paramIndex}) OR
        LOWER(COALESCE(excerpt, '')) LIKE LOWER($${paramIndex}) OR
        LOWER(COALESCE(content, '')) LIKE LOWER($${paramIndex})
      )`);
      queryParams.push(`%${String(q).trim()}%`);
      paramIndex++;
    }

    let orderBy = 'created_at DESC';
    switch (sort) {
      case 'date_old':
        orderBy = 'created_at ASC';
        break;
      case 'title_asc':
        orderBy = 'title ASC';
        break;
      case 'title_desc':
        orderBy = 'title DESC';
        break;
      case 'date_new':
      default:
        orderBy = 'created_at DESC';
        break;
    }

    let baseQuery = `
      SELECT id, title, slug, excerpt, cover_image, created_at
      FROM blog_posts
      ${whereConditions.length ? 'WHERE ' + whereConditions.join(' AND ') : ''}
      ORDER BY ${orderBy}
    `;

    const countQuery = `
      SELECT COUNT(*) as count FROM blog_posts
      ${whereConditions.length ? 'WHERE ' + whereConditions.join(' AND ') : ''}
    `;
    const { rows: countResult } = await query(countQuery, queryParams);
    const totalPosts = parseInt(countResult[0]?.count || '0', 10);

    const itemsPerPage = 9;
    const totalPages = Math.max(1, Math.ceil(totalPosts / itemsPerPage));
    const currentPage = Math.max(1, Math.min(parseInt(page) || 1, totalPages));
    const offset = (currentPage - 1) * itemsPerPage;

    const { rows: posts } = await query(
      baseQuery + ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, itemsPerPage, offset]
    );

    const normalizedPosts = posts.map(p => ({
      ...p,
      cover_image: p.cover_image || PLACEHOLDER_IMAGES[Math.floor(Math.random() * PLACEHOLDER_IMAGES.length)]
    }));

    res.render('blog/index', {
      title: 'Blog',
      bodyClass: 'page-blog header-dark',
      posts: normalizedPosts,
      totalPosts,
      currentPage,
      totalPages,
      query: q,
      sort
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Public: Show single blog post by slug
 */
exports.showPost = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const { rows } = await query(
      'SELECT id, title, slug, excerpt, content, cover_image, created_at, updated_at FROM blog_posts WHERE slug = $1',
      [slug]
    );

    if (!rows.length) {
      return res.status(404).render('errors/404', { title: 'Post not found' });
    }

    const post = rows[0];
    post.cover_image = post.cover_image || '/img/property-placeholder.jpg';

    res.render('blog/post', {
      title: post.title,
      bodyClass: 'page-blog-post header-dark',
      post
    });
  } catch (err) {
    next(err);
  }
};

// —————————————————————————————————————————————————————————————————————————————
// Admin / SuperAdmin: Blog management
// —————————————————————————————————————————————————————————————————————————————
const allowStaff = (req) =>
  req.session?.user?.role === 'Admin' || req.session?.user?.role === 'SuperAdmin';

/**
 * Admin: List all blog posts with pagination
 */
exports.listBlogsAdmin = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = 12;
    const offset = (page - 1) * perPage;

    const { rows } = await query(
      'SELECT COUNT(*) as count FROM blog_posts'
    );
    const totalPosts = parseInt(rows[0]?.count || '0', 10);
    const totalPages = Math.max(1, Math.ceil(totalPosts / perPage));
    const currentPage = Math.min(page, totalPages);
    const actualOffset = (currentPage - 1) * perPage;

    const { rows: posts } = await query(
      `SELECT id, title, slug, excerpt, cover_image, created_at
       FROM blog_posts
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [perPage, actualOffset]
    );

    const isSuperAdmin = req.session?.user?.role === 'SuperAdmin';
    const pendingCount = isSuperAdmin
      ? (await query("SELECT COUNT(*) AS count FROM users WHERE approved = false AND role IN ('Admin','SuperAdmin')")).rows[0]?.count || 0
      : 0;

    res.render('admin/blogs/manage-blogs', {
      title: 'Manage Blog Posts',
      currentUser: req.session.user,
      posts,
      currentPage,
      totalPages,
      totalPosts,
      pendingCount,
      isSuperAdmin
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: New blog form
 */
exports.newBlogForm = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    res.render('admin/blogs/new-blog', {
      title: 'New Blog Post',
      currentUser: req.session.user,
      form: {},
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Create blog post
 */
exports.createBlog = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const { title, excerpt, content, slug: customSlug } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.render('admin/blogs/new-blog', {
        title: 'New Blog Post',
        currentUser: req.session.user,
        form: { title, excerpt, content },
        error: 'Title is required.'
      });
    }
    const baseSlug = customSlug?.trim()
      ? slugify(customSlug)
      : slugify(title);
    const slug = await ensureUniqueSlug(baseSlug);
    const coverUrl = req.coverImageUrl || null;

    await query(
      `INSERT INTO blog_posts (title, slug, excerpt, content, cover_image)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        String(title).trim(),
        slug,
        (excerpt && String(excerpt).trim()) || null,
        (content && String(content).trim()) || null,
        coverUrl
      ]
    );

    const returnUrl = req.session?.user?.role === 'SuperAdmin'
      ? '/superadmin/dashboard/blogs'
      : '/admin/dashboard/blogs';
    res.redirect(returnUrl);
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Edit blog form
 */
exports.editBlogForm = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const { id } = req.params;
    const { rows } = await query(
      'SELECT id, title, slug, excerpt, content, cover_image, created_at FROM blog_posts WHERE id = $1',
      [id]
    );
    if (!rows.length) return res.status(404).send('Post not found');
    const post = rows[0];
    res.render('admin/blogs/edit-blog', {
      title: 'Edit Blog Post',
      currentUser: req.session.user,
      post,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Update blog post
 */
exports.updateBlog = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const { id } = req.params;
    const { title, excerpt, content, slug: customSlug } = req.body || {};
    if (!title || !String(title).trim()) {
      const { rows } = await query('SELECT * FROM blog_posts WHERE id = $1', [id]);
      return res.render('admin/blogs/edit-blog', {
        title: 'Edit Blog Post',
        currentUser: req.session.user,
        post: rows[0] || { id, title, excerpt, content, slug: customSlug },
        error: 'Title is required.'
      });
    }
    const baseSlug = customSlug?.trim()
      ? slugify(customSlug)
      : slugify(title);
    const slug = await ensureUniqueSlug(baseSlug, id);
    const coverUrl = req.coverImageUrl;

    if (coverUrl) {
      await query(
        `UPDATE blog_posts SET title=$1, slug=$2, excerpt=$3, content=$4, cover_image=$5, updated_at=NOW() WHERE id=$6`,
        [
          String(title).trim(),
          slug,
          (excerpt && String(excerpt).trim()) || null,
          (content && String(content).trim()) || null,
          coverUrl,
          id
        ]
      );
    } else {
      await query(
        `UPDATE blog_posts SET title=$1, slug=$2, excerpt=$3, content=$4, updated_at=NOW() WHERE id=$5`,
        [
          String(title).trim(),
          slug,
          (excerpt && String(excerpt).trim()) || null,
          (content && String(content).trim()) || null,
          id
        ]
      );
    }

    const returnUrl = req.session?.user?.role === 'SuperAdmin'
      ? '/superadmin/dashboard/blogs'
      : '/admin/dashboard/blogs';
    res.redirect(returnUrl);
  } catch (err) {
    next(err);
  }
};

/**
 * Admin: Delete blog post
 */
exports.deleteBlog = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const { id } = req.params;
    await query('DELETE FROM blog_posts WHERE id = $1', [id]);
    const returnUrl = req.session?.user?.role === 'SuperAdmin'
      ? '/superadmin/dashboard/blogs'
      : '/admin/dashboard/blogs';
    const page = req.query.page || 1;
    res.redirect(`${returnUrl}?page=${page}`);
  } catch (err) {
    next(err);
  }
};
