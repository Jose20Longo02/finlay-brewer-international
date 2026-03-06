// controllers/blogController.js
const { query } = require('../config/db');

const PLACEHOLDER_IMAGES = ['/img/France.jpg', '/img/Monaco.jpg', '/img/Montenegro.jpg', '/img/Costa%20Del%20Sol.jpg', '/img/London.jpg'];

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
