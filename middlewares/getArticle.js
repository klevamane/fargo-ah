import db from '../models';

const { Article, Like, User } = db;
const getArticle = (req, res, next) => {
  Article.findOne({
    include: [{
      model: User,
      attributes: { exclude: ['id', 'email', 'hashedPassword', 'createdAt', 'updatedAt'] }
    }, {
      model: Like,
      as: 'likes',
      include: [{
        model: User,
        as: 'user',
        attributes: { exclude: ['id', 'hashedPassword', 'createdAt', 'updatedAt'] }
      }],
    }],
    attributes: { exclude: ['userId'] },
    where: {
      slug: req.params.slug
    }
  })
    .then((article) => {
      if (!article) {
        return res.status(404).json({
          success: false,
          errors: {
            body: ['Ooops! the article cannot be found.']
          },
        });
      }
      req.articleObject = article;
      next();
    })
    .catch(next);
};

export default getArticle;
