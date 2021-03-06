import { Op } from 'sequelize';
import cloudinary from '../config/cloudinary';
import Utilities from '../helpers/utilities';
import { Article, User, Like, Payment } from '../models';
import createArticleHelper from '../helpers/createArticleHelper';

/**
 * Article class for users
 * @param {method} createArticle - Create article
 * @param {method} getArticle - Get a single article
 * @param {method} editArticle update a single article
*/
class ArticleController {
  /**
   * Create an article for a user
   * @param {object} req - The request object
   * @param {object} res - The response object sent to user
   * @return {object} A object containing created articles.
  */
  static createArticle(req, res) {
    const {
      title, description, body, tagList, categorylist, imageData, isPaidFor, price
    } = req.body.article;
    const { userId } = req;
    const articleObject = {
      title, description, body, tagList, categorylist, imageData, isPaidFor, price, userId
    };
    /**
     * check if image was provided in the request
     * upload the image to cloudinary, save the article
     * with the cloudinary URL in database but if an error
     * was encountered from cloudinary go ahead and create the article
    */
    if (imageData) {
      return cloudinary.v2.uploader.upload(imageData, { tags: 'basic_sample' })
        .then(image => createArticleHelper(res, articleObject, image.url))
        .catch(() => createArticleHelper(res, articleObject));
    }
    return createArticleHelper(res, articleObject);
  }

  /**
   * get an article using slug as query parameter
   * @param {object} req - request object
   * @param {object} res - response object
   * @param {function} next - to handle errors
   * @returns {object} - the found article from database or error if not found
   */
  static getArticle(req, res, next) {
    const { articleObject } = req;
    if (articleObject.isPaidFor === true) {
      return Payment.find({
        where: {
          [Op.and]: [
            { userId: req.userId },
            { articleId: articleObject.id }
          ]
        }
      })
        .then((payment) => {
          if (payment) {
            return res.status(200).json({
              article: articleObject,
            });
          }
          return res.status(400).json({
            errors: {
              body: ['You need to purchase this article to read it']
            }
          });
        })
        .catch(next);
    }
    return res.status(200).json({
      article: articleObject,
    });
  }

  /**
   * get all articles created and use the query
   * if provided to implement pagination
   * @param {object} req - request object
   * @param {object} res - response object
   * @param {function} next - to handle errors
   * @returns {object} - the found article from database or empty if not found
   */
  static listAllArticles(req, res, next) {
    const { page, limit } = req;
    let offset = null;
    if (req.query.author || req.query.tag || req.query.title || req.query.category) return next();

    if (page || limit) {
    // calculate offset
      offset = limit * (page - 1);
    }
    return Article
      .findAll({
        include: [{
          model: User,
          attributes: { exclude: ['id', 'email', 'hashedPassword', 'createdAt', 'updatedAt'] }
        }],
        offset,
        limit,
      })
      .then((articles) => {
        if (articles.length === 0) {
          /** check if there was no article created
          *  for the page query
          */
          const message = page ? 'articles limit exceeded'
            : 'Sorry, no articles created';
          return res.status(200).json({
            message,
            articles,
            articlesCount: articles.length
          });
        }
        return res.status(200).json({
          articles,
          articlesCount: articles.length
        });
      })
      .catch(next);
  }

  /**
  * @function editArticle
  * @summary: API controller to handle requests to edit an article
  * @param {object} req: request object
  * @param {object} res: response object
   * @param {function} next - to handle errors
  * @returns {object} api response: article object for
  * successful requests, or error object for
  * requests that fail
  */
  static editArticle(req, res, next) {
    const {
      title, description, body, isPaidFor, price
    } = req.body.article;
    const { count } = req;
    const { slug } = req.params;
    return Article.update({
      title,
      description,
      body,
      isPaidFor,
      price,
      updatedCount: Utilities.increaseCount(count)
    }, {
      where: {
        slug,
      },
      returning: true,
      plain: true
    })
      .then(result => res.status(200).json({
        success: true,
        article: result[1]
      }))
      .catch(next);
  }

  /**
  * @function deleteArticle
  * @summary: API controller to handle requests to delete an article
  * @param {object} req: request object
  * @param {object} res: response object
  * @param {function} next - next function
  * @returns {object} api response: article object for
  * successful requests, or error object for requests that fail
  */
  static deleteArticle(req, res, next) {
    const { slug } = req.params;
    Article.destroy({ where: { slug } })
      .then(() => res.status(200).json({ message: 'Article successfully deleted' }))
      .catch(next);
  }

  /**
  * @function CountLikes
  * @summary: controller to handle counting likes
  * @param {object} res
  * @param {integer} id
  * @returns {object} newOrFoundUser
  * @memberof AuthController
  */
  static countLikes(res, id) {
    Like.findAndCountAll({
      where: {
        [Op.and]: [
          { articleId: id }
        ]
      }
    })
      .then((articleLikes) => {
        res.status(200).json({
          success: 'true',
          totalLikes: articleLikes.count,
        });
      });
  }


  /**
  * @function likeArticle
  * @summary: API controller to handle requests to like an article
  * @param {object} req: request object
  * @param {object} res: response object
  * @param {object} next: response object
  * @returns {object} api response: article object for
  * successful requests, or error object for
  * requests that fail
  */
  static likeArticle(req, res, next) {
    const { userId } = req;
    const { id } = req.params;
    Like.find({
      where: {
        userId, articleId: id
      }
    })
      .then((like) => {
        if (!like) {
          Like.create({
            articleId: id,
            userId,
          })
            .then(() => {
              ArticleController.countLikes(res, id);
            });
        } else {
          Like.destroy({
            where: { id: like.id }
          })
            .then(() => {
              ArticleController.countLikes(res, id);
            });
        }
      })
      .catch(next);
  }

  /**
  * @function getAllTags
  * @summary: API controller to get all tags
  * @param {object} req: request object
  * @param {object} res: response object
  * @param {object} next: response object
  * @returns {object} response object with status code
  */
  static getAllTags(req, res, next) {
    return Article.findAll({
      attributes: { exclude: ['id', 'title', 'description', 'body', 'slug', 'updatedCount', 'createdAt', 'updatedAt', 'favorited', 'favoritesCount', 'imageUrl', 'userId'] },
    })
      .then((tagList) => {
      // create an array of all tags
        const tags = tagList.map(tag => tag.tagList)
          .reduce((acc, nextValue) => acc.concat(nextValue), []);

        // make a unique array of tags
        const uniqueTags = new Set(tags);

        if (uniqueTags.size === 0) {
          return res.status(200).json({
            message: 'No tags created',
            tags: uniqueTags,
          });
        }
        return res.status(200).json({
          tags: uniqueTags,
        });
      })
      .catch(next);
  }
}

export default ArticleController;
